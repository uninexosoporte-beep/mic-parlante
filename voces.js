// Personajes: cada uno arma una cadena de efectos de audio entre el micrófono y el parlante.
// Para agregar uno nuevo basta con sumar un objeto a VOCES con su función "armar".

// grupo: 'cuento' (cuento de hadas) o 'divertida'. tono = cuánto sube/baja (para las pruebas).
const VOCES = [
  { id: 'normal', grupo: 'divertida', nombre: 'Normal', emoji: '🙂', tono: 1, armar: () => [] },

  // ---------- Cuento de hadas ----------
  {
    id: 'princesa', grupo: 'cuento', nombre: 'Princesa', emoji: '👸', objetivoHz: 440,
    // Voz natural de alta calidad: lleva cualquier voz a ~440 Hz respetando la entonación,
    // con garganta un 24 % más pequeña, un poco de "aire" y sala suave de castillo.
    armar: (a) => [
      a.natural({ objetivoHz: 440, formante: 1.24 }),
      a.filtro('highpass', 160), a.filtro('peaking', 300, 1, -2),
      a.filtro('peaking', 3000, 0.9, 2), a.filtro('highshelf', 8500, 0, 4),
      a.sala(1.1, 0.16, 0.75), a.nivel(1.9),
    ],
  },
  // Todas usan el motor natural: objetivoHz = tono promedio al que llega cualquier voz,
  // formante = tamaño de la garganta (>1 más pequeña/joven, <1 más grande).
  {
    id: 'sirena', grupo: 'cuento', nombre: 'Sirena', emoji: '🧜‍♀️', objetivoHz: 330,
    // Joven y luminosa, con un brillo ondulante de agua.
    armar: (a) => [
      a.natural({ objetivoHz: 330, formante: 1.18 }),
      a.filtro('highpass', 160), a.filtro('highshelf', 7500, 0, 3),
      a.coro(0.004, 0.45), a.eco(0.18, 0.3, 0.22), a.sala(1.8, 0.28, 0.5), a.nivel(1.8),
    ],
  },
  {
    id: 'reina-hielo', grupo: 'cuento', nombre: 'Reina de hielo', emoji: '❄️', objetivoHz: 290,
    // Adulta, elegante y fría, con eco de palacio de hielo.
    armar: (a) => [
      a.natural({ objetivoHz: 290, formante: 1.14 }),
      a.filtro('highpass', 170), a.filtro('highshelf', 6000, 0, 5),
      a.eco(0.32, 0.35, 0.28), a.sala(2.4, 0.33, 0.9), a.nivel(1.8),
    ],
  },
  {
    id: 'hada', grupo: 'cuento', nombre: 'Hada madrina', emoji: '🧚', objetivoHz: 300,
    // Cálida, mágica y con un leve temblor de abuelita bondadosa.
    armar: (a) => [
      a.natural({ objetivoHz: 300, formante: 1.12 }), a.tremolo(6, 0.12),
      a.filtro('peaking', 2500, 1, 2), a.coro(0.003, 0.35), a.sala(1.5, 0.28, 0.8), a.nivel(1.8),
    ],
  },
  {
    id: 'principe', grupo: 'cuento', nombre: 'Príncipe', emoji: '🤴', objetivoHz: 110,
    // Grave, galán y heroico, en un gran salón.
    armar: (a) => [
      a.natural({ objetivoHz: 110, formante: 0.9 }),
      a.filtro('lowshelf', 200, 0, 4), a.filtro('peaking', 2800, 1, 2),
      a.sala(1.4, 0.2, 0.5), a.nivel(1.6),
    ],
  },
  {
    id: 'bruja', grupo: 'cuento', nombre: 'Bruja malvada', emoji: '🧙‍♀️', objetivoHz: 280,
    // Chillona, nasal, rasposa y temblorosa.
    armar: (a) => [
      a.natural({ objetivoHz: 280, formante: 1.1 }), a.tremolo(7, 0.3),
      a.filtro('peaking', 1500, 2, 7), a.distorsion(3), a.anillo(90, 0.15),
      a.sala(1.2, 0.25, 0.4), a.nivel(1.6),
    ],
  },
  {
    id: 'dragon', grupo: 'cuento', nombre: 'Dragón', emoji: '🐉', objetivoHz: 65,
    // Enorme y rugiente, desde una cueva.
    armar: (a) => [
      a.natural({ objetivoHz: 65, formante: 0.72 }), a.distorsion(7),
      a.filtro('lowshelf', 180, 0, 7), a.filtro('lowpass', 3000),
      a.eco(0.12, 0.3, 0.3), a.sala(2.2, 0.4, 0.25), a.nivel(1.4),
    ],
  },
  {
    id: 'sapo', grupo: 'cuento', nombre: 'Sapo encantado', emoji: '🐸', objetivoHz: 85,
    // Príncipe convertido en sapo: grave y croante.
    armar: (a) => [
      a.natural({ objetivoHz: 85, formante: 0.82 }), a.anillo(28, 0.5),
      a.filtro('peaking', 900, 2, 6), a.distorsion(3), a.nivel(1.4),
    ],
  },

  // ---------- Divertidas ----------
  {
    id: 'pato', grupo: 'divertida', nombre: 'Pato', emoji: '🦆', objetivoHz: 420,
    // Pato de caricatura: aguda, muy nasal, rasposa y con aleteo (graznido).
    armar: (a) => [
      a.natural({ objetivoHz: 420, formante: 1.38 }),
      a.filtro('highpass', 550), a.filtro('peaking', 1450, 3.5, 12), a.filtro('peaking', 2900, 2, 5),
      a.filtro('lowpass', 4800), a.distorsion(5),
      a.anillo(38, 0.35), a.tremolo(24, 0.3), a.nivel(1.5),
    ],
  },
  {
    id: 'ardilla', grupo: 'divertida', nombre: 'Ardilla', emoji: '🐿️', tono: 2.1,
    armar: (a) => [a.tono(2.1), a.filtro('highpass', 250)],
  },
  {
    id: 'bebe', grupo: 'divertida', nombre: 'Bebé', emoji: '👶', tono: 1.7,
    armar: (a) => [a.tono(1.7, { vibrato: 6, profundidad: 0.03 }), a.filtro('peaking', 2500, 1, 6), a.filtro('highpass', 300)],
  },
  {
    id: 'robot', grupo: 'divertida', nombre: 'Robot', emoji: '🤖', tono: 0.9,
    armar: (a) => [a.tono(0.9), a.anillo(50), a.peine(0.009, 0.75), a.distorsion(3), a.filtro('highpass', 150)],
  },
  {
    id: 'monstruo', grupo: 'divertida', nombre: 'Monstruo', emoji: '👹', tono: 0.5,
    armar: (a) => [a.tono(0.5), a.distorsion(10), a.filtro('lowshelf', 220, 0, 9), a.filtro('lowpass', 3000)],
  },
  {
    id: 'alien', grupo: 'divertida', nombre: 'Alien', emoji: '👽', tono: 1.3,
    armar: (a) => [a.tono(1.3, { vibrato: 11, profundidad: 0.1 }), a.anillo(360, 0.65), a.eco(0.07, 0.4, 0.4)],
  },
  {
    id: 'fantasma', grupo: 'divertida', nombre: 'Fantasma', emoji: '👻', tono: 0.75,
    armar: (a) => [
      a.tono(0.75, { vibrato: 2.5, profundidad: 0.05 }), a.eco(0.3, 0.65, 0.8),
      a.filtro('lowpass', 2400), a.sala(3, 0.6, 0.3),
    ],
  },
  {
    id: 'abuelito', grupo: 'divertida', nombre: 'Abuelito', emoji: '👴', tono: 0.8,
    armar: (a) => [a.tono(0.8, { vibrato: 6.5, profundidad: 0.045 }), a.tremolo(6.5, 0.45), a.filtro('highpass', 200)],
  },
  {
    id: 'gigante', grupo: 'divertida', nombre: 'Gigante', emoji: '🦖', tono: 0.55,
    armar: (a) => [a.tono(0.55), a.eco(0.1, 0.45, 0.55), a.filtro('lowshelf', 180, 0, 8), a.sala(2, 0.4, 0.3)],
  },
  {
    id: 'radio', grupo: 'divertida', nombre: 'Radio', emoji: '📻', tono: 1,
    armar: (a) => [a.filtro('bandpass', 1700, 1.6), a.distorsion(6), a.filtro('highpass', 500)],
  },
];

/**
 * Arma la voz pedida y devuelve { entrada, salida, detener }.
 * ventanaMs: tamaño de ventana del cambiador de tono (más chico = menos retraso, algo más áspero).
 */
function crearVoz(ctx, id, ventanaMs = 40) {
  const voz = VOCES.find((v) => v.id === id) || VOCES[0];
  const osciladores = [];

  const oscilador = (frecuencia) => {
    const o = ctx.createOscillator();
    o.frequency.value = frecuencia;
    o.start();
    osciladores.push(o);
    return o;
  };

  // Cada bloque devuelve { entrada, salida } para encadenarlos en orden.
  const bloques = {
    tono(factor, { vibrato = 0, profundidad = 0 } = {}) {
      const n = new AudioWorkletNode(ctx, 'cambiador-de-tono', {
        outputChannelCount: [1],
        processorOptions: { ventanaMs },
      });
      n.parameters.get('factor').value = factor;
      if (vibrato) {
        const lfo = oscilador(vibrato);
        const cuanto = ctx.createGain();
        cuanto.gain.value = factor * profundidad;
        lfo.connect(cuanto).connect(n.parameters.get('factor'));
      }
      return { entrada: n, salida: n };
    },

    // Cambio de tono natural (conserva la forma de la voz). Ver VozNatural en voces-worklet.js.
    natural({ objetivoHz = 0, factor = 1, formante = 1 }) {
      const n = new AudioWorkletNode(ctx, 'voz-natural', {
        outputChannelCount: [1],
        processorOptions: { objetivoHz, factor, formante },
      });
      return { entrada: n, salida: n };
    },

    // Compensa el volumen de una voz (el limitador final evita que sature).
    nivel(veces) {
      const g = ctx.createGain();
      g.gain.value = veces;
      return { entrada: g, salida: g };
    },

    filtro(tipo, frecuencia, q = 0.7, ganancia = 0) {
      const f = ctx.createBiquadFilter();
      Object.assign(f, { type: tipo });
      f.frequency.value = frecuencia;
      f.Q.value = q;
      f.gain.value = ganancia;
      return { entrada: f, salida: f };
    },

    // Modulación en anillo: multiplica la voz por un tono (suena metálica). mezcla 1 = solo efecto.
    anillo(frecuencia, mezcla = 1) {
      const entrada = ctx.createGain();
      const salida = ctx.createGain();
      const modulada = ctx.createGain();
      modulada.gain.value = 0;
      oscilador(frecuencia).connect(modulada.gain);
      const seca = ctx.createGain();
      seca.gain.value = 1 - mezcla;
      const humeda = ctx.createGain();
      humeda.gain.value = mezcla * 1.4;
      entrada.connect(modulada).connect(humeda).connect(salida);
      entrada.connect(seca).connect(salida);
      return { entrada, salida };
    },

    // Filtro peine: retardo muy corto realimentado (timbre de lata).
    peine(segundos, realimentacion) {
      const entrada = ctx.createGain();
      const retardo = ctx.createDelay(0.1);
      retardo.delayTime.value = segundos;
      const vuelta = ctx.createGain();
      vuelta.gain.value = realimentacion;
      entrada.connect(retardo).connect(vuelta).connect(retardo);
      const salida = ctx.createGain();
      salida.gain.value = 0.7;
      entrada.connect(salida);
      retardo.connect(salida);
      return { entrada, salida };
    },

    // Eco con repeticiones; mezcla = cuánto eco se suma a la voz.
    eco(segundos, realimentacion, mezcla) {
      const entrada = ctx.createGain();
      const salida = ctx.createGain();
      const retardo = ctx.createDelay(2);
      retardo.delayTime.value = segundos;
      const vuelta = ctx.createGain();
      vuelta.gain.value = realimentacion;
      const nivel = ctx.createGain();
      nivel.gain.value = mezcla;
      entrada.connect(salida);
      entrada.connect(retardo).connect(vuelta).connect(retardo);
      retardo.connect(nivel).connect(salida);
      return { entrada, salida };
    },

    distorsion(cantidad) {
      const w = ctx.createWaveShaper();
      const curva = new Float32Array(1024);
      for (let i = 0; i < curva.length; i++) {
        const x = (i / (curva.length - 1)) * 2 - 1;
        curva[i] = Math.tanh(cantidad * x) / Math.tanh(cantidad);
      }
      w.curve = curva;
      w.oversample = '2x';
      const bajar = ctx.createGain();
      bajar.gain.value = 0.7;
      w.connect(bajar);
      return { entrada: w, salida: bajar };
    },

    // Coro: dos copias con retardo que ondula, suena "soñado" o a varias voces juntas.
    coro(profundidad = 0.004, mezcla = 0.6) {
      const entrada = ctx.createGain();
      const salida = ctx.createGain();
      entrada.connect(salida);
      [[0.018, 0.8], [0.027, 1.3]].forEach(([base, velocidad]) => {
        const r = ctx.createDelay(0.1);
        r.delayTime.value = base;
        const cuanto = ctx.createGain();
        cuanto.gain.value = profundidad;
        oscilador(velocidad).connect(cuanto).connect(r.delayTime);
        const nivel = ctx.createGain();
        nivel.gain.value = mezcla;
        entrada.connect(r).connect(nivel).connect(salida);
      });
      const bajar = ctx.createGain();
      bajar.gain.value = 1 / (1 + mezcla);
      salida.connect(bajar);
      return { entrada, salida: bajar };
    },

    // Sala: reverberación real (castillo, cueva…). segundos = cuánto dura la cola.
    sala(segundos, mezcla, brillo = 0.5) {
      const entrada = ctx.createGain();
      const salida = ctx.createGain();
      const largo = Math.round(ctx.sampleRate * segundos);
      const impulso = ctx.createBuffer(2, largo, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = impulso.getChannelData(c);
        let previo = 0;
        for (let i = 0; i < largo; i++) {
          const ruido = Math.random() * 2 - 1;
          previo = brillo * ruido + (1 - brillo) * previo; // menos brillo = cola más oscura
          d[i] = previo * (1 - i / largo) ** 2.5;
        }
      }
      const conv = ctx.createConvolver();
      conv.buffer = impulso;
      const nivel = ctx.createGain();
      nivel.gain.value = mezcla;
      entrada.connect(salida);
      entrada.connect(conv).connect(nivel).connect(salida);
      return { entrada, salida };
    },

    // Volumen que tiembla (voz temblorosa).
    tremolo(frecuencia, profundidad) {
      const g = ctx.createGain();
      g.gain.value = 1 - profundidad;
      const cuanto = ctx.createGain();
      cuanto.gain.value = profundidad;
      oscilador(frecuencia).connect(cuanto).connect(g.gain);
      return { entrada: g, salida: g };
    },
  };

  const cadena = voz.armar(bloques);
  const entrada = ctx.createGain();
  let ultimo = entrada;
  for (const b of cadena) {
    ultimo.connect(b.entrada);
    ultimo = b.salida;
  }
  // Limitador final: las voces exageradas (eco, sala, distorsión) no saturan el parlante.
  const limitador = ctx.createDynamicsCompressor();
  limitador.threshold.value = -8;
  limitador.knee.value = 4;
  limitador.ratio.value = 12;
  limitador.attack.value = 0.003;
  limitador.release.value = 0.15;
  const salida = ctx.createGain();
  ultimo.connect(limitador).connect(salida);

  return {
    entrada,
    salida,
    detener() {
      osciladores.forEach((o) => { try { o.stop(); } catch { /* ya detenido */ } });
      entrada.disconnect();
      salida.disconnect();
    },
  };
}
