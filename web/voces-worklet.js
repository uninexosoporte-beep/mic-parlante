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
