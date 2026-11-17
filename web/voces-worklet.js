// Cambiador de tono en tiempo real (corre en el hilo de audio).
// Técnica de línea de retardo: dos lecturas separadas media ventana que avanzan
// más rápido o más lento que la escritura, mezcladas con fundido para que no se note el salto.

class CambiadorDeTono extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'factor', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'a-rate' }];
  }

  constructor(opciones) {
    super();
    const ms = opciones?.processorOptions?.ventanaMs ?? 40;
    this.ventana = Math.max(64, Math.round((sampleRate * ms) / 1000));
    let tam = 1;
    while (tam < this.ventana * 2 + 4) tam <<= 1;
    this.buffer = new Float32Array(tam);
    this.mascara = tam - 1;
    this.escritura = 0;
    this.fase = 0;
  }

  leer(retardo) {
    // Lectura con interpolación lineal entre dos muestras.
    const pos = this.escritura - retardo;
    const base = Math.floor(pos);
    const frac = pos - base;
    const a = this.buffer[base & this.mascara];
    const b = this.buffer[(base + 1) & this.mascara];
    return a + (b - a) * frac;
  }

  process(entradas, salidas, parametros) {
    const entrada = entradas[0]?.[0];
    const salida = salidas[0];
    if (!salida?.[0]) return true;
    const canal = salida[0];
    const factores = parametros.factor;
    const W = this.ventana;

    for (let i = 0; i < canal.length; i++) {
      this.buffer[this.escritura & this.mascara] = entrada ? entrada[i] : 0;
      const f = factores.length > 1 ? factores[i] : factores[0];

      // La fase recorre la ventana; su velocidad define cuánto sube o baja el tono.
      this.fase += (1 - f) / W;
      this.fase -= Math.floor(this.fase);
      const fase2 = (this.fase + 0.5) % 1;

      const g1 = Math.sin(Math.PI * this.fase) ** 2; // g1 + g2 = 1 siempre
      const g2 = 1 - g1;
      canal[i] = g1 * this.leer(this.fase * W) + g2 * this.leer(fase2 * W);
      this.escritura++;
    }
    for (let c = 1; c < salida.length; c++) salida[c].set(canal);
    return true;
  }
}

registerProcessor('cambiador-de-tono', CambiadorDeTono);

// ---------------------------------------------------------------------------
// Voz natural (PSOLA): sube o baja el tono ciclo a ciclo de la voz, conservando
// la forma de la boca y la garganta (formantes). Así no suena a "ardilla".
//   objetivoHz: tono promedio al que se lleva la voz, sea quien sea el que habla
//               (se respeta la entonación). 0 = usar "factor" fijo.
//   formante:   cuánto se corren las resonancias (1.2 ≈ garganta más pequeña).
// ---------------------------------------------------------------------------
class VozNatural extends AudioWorkletProcessor {
  constructor(opciones) {
    super();
    const o = opciones?.processorOptions || {};
    this.objetivo = o.objetivoHz || 0;
    this.factorFijo = o.factor || 1;
    this.alfa = o.formante || 1;

    this.N = 16384;
    this.mascara = this.N - 1;
    this.ent = new Float32Array(this.N);
    this.sal = new Float32Array(this.N);
    this.peso = new Float32Array(this.N);
    this.n = 0; // muestras recibidas (tiempo absoluto)

    this.Tmin = Math.floor(sampleRate / 500);
    this.Tmax = Math.ceil(sampleRate / 85);
    this.retardo = 3 * this.Tmax + 256;
    this.Tsorda = Math.round(sampleRate * 0.006); // paso para sonidos sin tono (s, f, j…)

    // Detección de tono (YIN) sobre la señal reducida a 1/4.
    this.dMax = Math.ceil(this.Tmax / 4) + 2;
    this.dMin = Math.max(2, Math.floor(this.Tmin / 4));
    this.dec = new Float32Array(this.dMax * 2 + 2);
    this.dif = new Float32Array(this.dMax + 1);
    this.cada = 256;
    this.contador = 0;

    this.T0 = Math.round(sampleRate / 150);
    this.sonora = false;
    this.f0medio = 0;

    this.marcas = [];
    this.k = 0;
    this.ultimaMarca = 0;
    this.previaSonora = false;
    this.sint = 0; // centro de la próxima onda que se pega a la salida
  }

  muestra(pos) {
    const b = Math.floor(pos);
    const f = pos - b;
    const a = this.ent[b & this.mascara];
    return a + (this.ent[(b + 1) & this.mascara] - a) * f;
  }

  detectar() {
    const M = this.dec.length;
    const inicio = this.n - M * 4;
    if (inicio < 0) return;
    let energia = 0;
    for (let i = 0; i < M; i++) {
      const p = inicio + i * 4;
      const v = (this.ent[p & this.mascara] + this.ent[(p + 1) & this.mascara]
        + this.ent[(p + 2) & this.mascara] + this.ent[(p + 3) & this.mascara]) * 0.25;
      this.dec[i] = v;
      energia += v * v;
    }
    if (Math.sqrt(energia / M) < 0.006) { this.sonora = false; return; }

    const W = this.dMax;
    const d = this.dif;
    let acumulado = 0;
    let elegido = -1;
    d[0] = 1;
    for (let tau = 1; tau <= this.dMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) {
        const x = this.dec[j] - this.dec[j + tau];
        s += x * x;
      }
      acumulado += s;
      d[tau] = acumulado > 0 ? (s * tau) / acumulado : 1;
    }
    for (let tau = this.dMin; tau < this.dMax; tau++) {
      if (d[tau] < 0.18) {
        while (tau + 1 < this.dMax && d[tau + 1] < d[tau]) tau++;
        elegido = tau;
        break;
      }
    }
    if (elegido < 0) { this.sonora = false; return; }

    // Interpolación parabólica para afinar el período.
    const a = d[elegido - 1], b = d[elegido], c = d[elegido + 1];
    const den = a - 2 * b + c;
    const ajuste = den !== 0 ? (0.5 * (a - c)) / den : 0;
    const T = Math.max(this.Tmin, Math.min(this.Tmax, (elegido + ajuste) * 4));

    this.T0 = this.sonora && Math.abs(T - this.T0) < this.T0 * 0.25 ? 0.6 * this.T0 + 0.4 * T : T;
    this.sonora = true;
    const f0 = sampleRate / this.T0;
    this.f0medio = this.f0medio ? 0.992 * this.f0medio + 0.008 * f0 : f0;
  }

  // Ajusta la nueva marca para que caiga en el mismo punto del ciclo que la anterior.
  afinarMarca(p, T) {
    const r = Math.max(2, Math.floor(T / 4));
    const medio = Math.floor(T / 2);
    let mejor = p;
    let mejorValor = -Infinity;
    for (let d = -r; d <= r; d++) {
      let s = 0;
      for (let k = -medio; k <= medio; k += 2) {
        s += this.ent[(this.ultimaMarca + k) & this.mascara] * this.ent[(p + d + k) & this.mascara];
      }
      if (s > mejorValor) { mejorValor = s; mejor = p + d; }
    }
    return mejor;
  }

  crearMarcas() {
    for (;;) {
      const T = Math.round(this.sonora ? this.T0 : this.Tsorda);
      let p = this.ultimaMarca + T;
      if (p + Math.ceil(1.6 * T) + (T >> 2) + 2 >= this.n) break;
      if (this.sonora && this.previaSonora) p = this.afinarMarca(p, T);
      this.marcas.push({ pos: p, T, sonora: this.sonora });
      this.ultimaMarca = p;
      this.previaSonora = this.sonora;
    }
    // Olvidar marcas que ya no se van a usar.
    const limite = this.sint - 3 * this.Tmax;
    let quitar = 0;
    while (quitar < this.marcas.length - 2 && this.marcas[quitar].pos < limite) quitar++;
    if (quitar) {
      this.marcas.splice(0, quitar);
      this.k = Math.max(0, this.k - quitar);
    }
  }

  pegarOnda(hasta) {
    const m = this.marcas;
    while (this.sint <= hasta && m.length) {
      while (this.k + 1 < m.length && Math.abs(m[this.k + 1].pos - this.sint) <= Math.abs(m[this.k].pos - this.sint)) this.k++;
      const marca = m[this.k];
      const T = marca.T;
      let beta = 1;
      if (marca.sonora) {
        beta = this.objetivo && this.f0medio ? this.objetivo / this.f0medio : this.factorFijo;
        beta = Math.max(0.5, Math.min(4, beta)); // hasta una octava abajo (dragón) o ×4 arriba (princesa)
      }
      const paso = T / beta;
      const alfa = this.alfa;
      const medio = Math.max(2, Math.round(Math.min(1.5 * T, Math.max(T, paso * alfa)) / alfa));
      const centro = Math.round(this.sint);
      for (let j = -medio; j <= medio; j++) {
        const w = 0.5 + 0.5 * Math.cos((Math.PI * j) / medio);
        const i = (centro + j) & this.mascara;
        this.sal[i] += w * this.muestra(marca.pos + j * alfa);
        this.peso[i] += w;
      }
      this.sint += paso;
    }
  }

  process(entradas, salidas) {
    const entrada = entradas[0]?.[0];
    const salida = salidas[0];
    if (!salida?.[0]) return true;
    const canal = salida[0];
    const largo = canal.length;

    for (let i = 0; i < largo; i++) this.ent[(this.n + i) & this.mascara] = entrada ? entrada[i] : 0;
    if (this.n === 0) { this.ultimaMarca = 0; this.sint = 0; }
    this.n += largo;

    this.contador += largo;
    if (this.contador >= this.cada) { this.contador = 0; this.detectar(); }
    this.crearMarcas();

    const primera = this.n - largo - this.retardo;
    this.pegarOnda(primera + largo + this.Tmax);

    for (let i = 0; i < largo; i++) {
      const t = primera + i;
      if (t < 0) { canal[i] = 0; continue; }
      const idx = t & this.mascara;
      const w = this.peso[idx];
      canal[i] = w > 1e-4 ? this.sal[idx] / w : 0;
      this.sal[idx] = 0;
      this.peso[idx] = 0;
    }
    for (let c = 1; c < salida.length; c++) salida[c].set(canal);
    return true;
  }
}

registerProcessor('voz-natural', VozNatural);
