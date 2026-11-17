// Personajes: cada uno arma una cadena de efectos de audio entre el micrófono y el parlante.
// Para agregar uno nuevo basta con sumar un objeto a VOCES con su función "armar".

const VOCES = [
  { id: 'normal', nombre: 'Normal', emoji: '🙂', armar: () => [] },
  {
    id: 'ardilla', nombre: 'Ardilla', emoji: '🐿️',
    armar: (a) => [a.tono(1.75), a.filtro('highpass', 180)],
  },
  {
    id: 'bebe', nombre: 'Bebé', emoji: '👶',
    armar: (a) => [a.tono(1.4, { vibrato: 5, profundidad: 0.015 }), a.filtro('peaking', 2500, 1, 4)],
  },
  {
    id: 'robot', nombre: 'Robot', emoji: '🤖',
    armar: (a) => [a.tono(0.92), a.anillo(55), a.peine(0.011, 0.55), a.filtro('highpass', 120)],
  },
  {
    id: 'monstruo', nombre: 'Monstruo', emoji: '👹',
    armar: (a) => [a.tono(0.6), a.distorsion(6), a.filtro('lowshelf', 220, 0, 7), a.filtro('lowpass', 3200)],
  },
  {
    id: 'alien', nombre: 'Alien', emoji: '👽',
    armar: (a) => [a.tono(1.22, { vibrato: 9, profundidad: 0.06 }), a.anillo(320, 0.5)],
  },
  {
    id: 'fantasma', nombre: 'Fantasma', emoji: '👻',
    armar: (a) => [a.tono(0.85, { vibrato: 3, profundidad: 0.03 }), a.eco(0.28, 0.5, 0.6), a.filtro('lowpass', 2600)],
  },
  {
    id: 'abuelito', nombre: 'Abuelito', emoji: '👴',
    armar: (a) => [a.tono(0.84, { vibrato: 6.5, profundidad: 0.025 }), a.tremolo(6.5, 0.25), a.filtro('highpass', 160)],
  },
  {
    id: 'gigante', nombre: 'Gigante', emoji: '🦖',
    armar: (a) => [a.tono(0.7), a.eco(0.09, 0.35, 0.45), a.filtro('lowshelf', 180, 0, 6)],
  },
  {
    id: 'radio', nombre: 'Radio', emoji: '📻',
    armar: (a) => [a.filtro('bandpass', 1600, 1.1), a.distorsion(3), a.filtro('highpass', 400)],
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
  const salida = ctx.createGain();
  ultimo.connect(salida);

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
