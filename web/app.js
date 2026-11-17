// Mic Parlante: pasa el micrófono en vivo a la salida de audio (parlante Bluetooth).
// Cadena: micrófono → ganancia → analizador (medidor) → salida.

const $ = (id) => document.getElementById(id);
const ui = {
  boton: $('boton'),
  pista: $('pista'),
  estado: $('estado'),
  salida: $('salida'),
  nivel: $('nivel'),
  volumen: $('volumen'),
  volumenValor: $('volumen-valor'),
  bajaLatencia: $('baja-latencia'),
  latencia: $('latencia'),
  filaSalida: $('fila-salida'),
  selectorSalida: $('selector-salida'),
  modos: document.querySelectorAll('.segmentado button'),
};

// Dentro de la app Android existe el puente "Android" (pantalla encendida, salida de audio).
const enApp = typeof window.Android !== 'undefined';

const PATRON_BT = /bluetooth|\bbt\b|airpods|buds|jbl|bose|sony|headset|hands-?free|auricular|parlante|a2dp|hfp/i;

const estado = {
  modo: 'alternar',     // 'alternar' | 'mantener'
  hablando: false,
  ctx: null,
  flujo: null,
  ganancia: null,
  analizador: null,
  bloqueoPantalla: null,
  abriendo: null,       // promesa mientras se abre el micrófono
  idSalida: 'default',
};

// ---------- Preferencias guardadas ----------
function leerPref(clave, porDefecto) {
  try { return localStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; }
}
function guardarPref(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
}

// ---------- Audio ----------
// Evita abrir el micrófono dos veces si se toca rápido mientras se pide permiso.
function abrirAudio() {
  if (estado.ctx) return Promise.resolve();
  estado.abriendo ??= crearAudio().finally(() => { estado.abriendo = null; });
  return estado.abriendo;
}

async function crearAudio() {
  const bajaLatencia = ui.bajaLatencia.checked;

  estado.flujo = await navigator.mediaDevices.getUserMedia({
    audio: {
      // En baja latencia se quitan los filtros de voz: suenan más naturales y agregan menos retraso.
      echoCancellation: !bajaLatencia,
      noiseSuppression: !bajaLatencia,
      autoGainControl: !bajaLatencia,
      channelCount: 1,
    },
  });

  const ctx = new AudioContext({ latencyHint: bajaLatencia ? 'interactive' : 'playback' });
  const fuente = ctx.createMediaStreamSource(estado.flujo);
  const ganancia = ctx.createGain();
  ganancia.gain.value = 0;
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 512;

  fuente.connect(ganancia).connect(analizador).connect(ctx.destination);
  Object.assign(estado, { ctx, ganancia, analizador });

  if (estado.idSalida !== 'default' && ctx.setSinkId) {
    try { await ctx.setSinkId(estado.idSalida); } catch { estado.idSalida = 'default'; }
  }
  await ctx.resume();
  mostrarLatencia();
  await revisarSalidas(); // con permiso de micrófono ya se ven los nombres de los dispositivos
}

async function cerrarAudio() {
  await estado.abriendo?.catch(() => {});
  estado.flujo?.getTracks().forEach((t) => t.stop());
  await estado.ctx?.close().catch(() => {});
  Object.assign(estado, { ctx: null, flujo: null, ganancia: null, analizador: null });
  ui.latencia.textContent = '';
}

function fijarGanancia(valor) {
  const { ctx, ganancia } = estado;
  if (!ctx) return;
  // Rampa corta para evitar el "clic" al abrir o cerrar.
  ganancia.gain.cancelScheduledValues(ctx.currentTime);
  ganancia.gain.setTargetAtTime(valor, ctx.currentTime, 0.015);
}

function mostrarLatencia() {
  const { ctx } = estado;
  if (!ctx) return;
  const ms = Math.round(((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000);
  ui.latencia.textContent = ms
    ? `Retraso del navegador: ~${ms} ms (más el del Bluetooth)`
    : 'El Bluetooth suma su propio retraso (~150–250 ms)';
}

// ---------- Hablar / callar ----------
async function empezar() {
  if (estado.hablando) return;
  estado.hablando = true;
  pintar();
  try {
    await abrirAudio();
    if (!estado.hablando) { // se soltó o se volvió a tocar mientras se pedía permiso
      if (estado.modo === 'alternar') await cerrarAudio();
      return;
    }
    fijarGanancia(Number(ui.volumen.value));
    pedirPantallaEncendida();
    animarMedidor();
  } catch (err) {
    estado.hablando = false;
    pintar();
    ui.estado.textContent = err.name === 'NotAllowedError'
      ? (enApp
        ? 'Sin permiso de micrófono: actívalo en Ajustes > Apps > Mic Parlante > Permisos'
        : 'Sin permiso de micrófono: actívalo en el candado de la barra de direcciones')
      : `No se pudo abrir el micrófono (${err.name || err.message})`;
  }
}

async function parar() {
  if (!estado.hablando) return;
  estado.hablando = false;
  fijarGanancia(0);
  soltarPantalla();
  pintar();
  // En "Mantener" el micrófono queda abierto para que la próxima vez arranque sin espera.
  if (estado.modo === 'alternar') await cerrarAudio();
}

function pintar() {
  ui.boton.classList.toggle('activo', estado.hablando);
  ui.boton.setAttribute('aria-pressed', String(estado.hablando));
  ui.estado.textContent = estado.hablando ? 'Transmitiendo' : 'En espera';
  ui.pista.textContent = estado.modo === 'alternar'
    ? (estado.hablando ? 'Toca para callar' : 'Toca para hablar')
    : 'Mantén presionado para hablar';
  if (!estado.hablando) {
    ui.nivel.style.width = '0';
    ui.boton.style.setProperty('--pulso', 1);
  }
}

function animarMedidor() {
  const datos = new Float32Array(estado.analizador.fftSize);
  const paso = () => {
    if (!estado.hablando || !estado.analizador) return;
    estado.analizador.getFloatTimeDomainData(datos);
    let suma = 0;
    for (const v of datos) suma += v * v;
    const rms = Math.sqrt(suma / datos.length);
    const nivel = Math.min(1, rms * 4);
    ui.nivel.style.width = `${Math.round(nivel * 100)}%`;
    ui.boton.style.setProperty('--pulso', (1 + nivel * 0.08).toFixed(3));
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// ---------- Pantalla encendida mientras transmite ----------
async function pedirPantallaEncendida() {
  if (enApp) { window.Android.pantallaEncendida(true); return; }
  try { estado.bloqueoPantalla = await navigator.wakeLock?.request('screen'); } catch { /* no disponible */ }
}
function soltarPantalla() {
  if (enApp) window.Android.pantallaEncendida(false);
  estado.bloqueoPantalla?.release().catch(() => {});
  estado.bloqueoPantalla = null;
}

// ---------- Salidas de audio ----------
async function revisarSalidas() {
  if (enApp) {
    // Android sabe con certeza si hay un Bluetooth conectado y cómo se llama.
    const bt = window.Android.salidaBluetooth();
    ui.salida.textContent = bt ? `Saliendo por: ${bt}` : 'No se detecta Bluetooth: conecta un parlante primero';
    ui.salida.classList.toggle('ok', Boolean(bt));
    ui.filaSalida.hidden = true;
    return;
  }
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const salidas = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'audiooutput');

  const actual = salidas.find((d) => d.deviceId === estado.idSalida) || salidas[0];
  const nombre = actual?.label || '';
  const hayBt = salidas.some((d) => PATRON_BT.test(d.label));

  if (PATRON_BT.test(nombre)) {
    ui.salida.textContent = `Saliendo por: ${nombre.replace(/^(Predeterminado|Default) - /i, '')}`;
    ui.salida.classList.add('ok');
  } else if (nombre) {
    ui.salida.textContent = hayBt
      ? 'Hay un Bluetooth conectado: elígelo en "Salida"'
      : 'No se detecta Bluetooth: conecta un parlante primero';
    ui.salida.classList.remove('ok');
  } else {
    // Sin permiso todavía, o el navegador (como Chrome en Android) no da los nombres.
    ui.salida.textContent = 'Conecta tu parlante Bluetooth y toca el botón';
    ui.salida.classList.remove('ok');
  }

  // El selector solo sirve si el navegador deja elegir la salida y hay más de una con nombre.
  const puedeElegir = 'setSinkId' in AudioContext.prototype && salidas.filter((d) => d.label).length > 1;
  ui.filaSalida.hidden = !puedeElegir;
  if (puedeElegir) {
    ui.selectorSalida.replaceChildren(...salidas.map((d) => {
      const op = new Option(d.label || 'Salida sin nombre', d.deviceId);
      op.selected = d.deviceId === estado.idSalida;
      return op;
    }));
  }
}

// ---------- Eventos ----------
ui.boton.addEventListener('click', () => {
  if (estado.modo !== 'alternar') return;
  estado.hablando ? parar() : empezar();
});

ui.boton.addEventListener('pointerdown', (e) => {
  if (estado.modo !== 'mantener') return;
  ui.boton.setPointerCapture(e.pointerId);
  empezar();
});
for (const tipo of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  ui.boton.addEventListener(tipo, () => { if (estado.modo === 'mantener') parar(); });
}
ui.boton.addEventListener('contextmenu', (e) => e.preventDefault());

// Teclado: Espacio/Enter funcionan en los dos modos.
ui.boton.addEventListener('keydown', (e) => {
  if (estado.modo !== 'mantener' || (e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
  e.preventDefault();
  empezar();
});
ui.boton.addEventListener('keyup', (e) => {
  if (estado.modo === 'mantener' && (e.key === ' ' || e.key === 'Enter')) parar();
});

ui.modos.forEach((b) => b.addEventListener('click', async () => {
  if (b.dataset.modo === estado.modo) return;
  await parar();
  await cerrarAudio();
  fijarModo(b.dataset.modo);
}));

function fijarModo(modo) {
  estado.modo = modo;
  ui.modos.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.modo === modo)));
  guardarPref('modo', modo);
  pintar();
}

ui.volumen.addEventListener('input', () => {
  ui.volumenValor.textContent = `${Math.round(ui.volumen.value * 100)}%`;
  if (estado.hablando) fijarGanancia(Number(ui.volumen.value));
  guardarPref('volumen', ui.volumen.value);
});

ui.bajaLatencia.addEventListener('change', async () => {
  guardarPref('bajaLatencia', ui.bajaLatencia.checked ? '1' : '0');
  // La latencia se fija al crear el audio: se rearma si ya estaba abierto.
  const ibaHablando = estado.hablando;
  estado.hablando = false;
  soltarPantalla();
  await cerrarAudio();
  if (ibaHablando) empezar();
});

ui.selectorSalida.addEventListener('change', async () => {
  estado.idSalida = ui.selectorSalida.value;
  guardarPref('salida', estado.idSalida);
  try { await estado.ctx?.setSinkId(estado.idSalida); } catch { /* se aplicará al reabrir */ }
  revisarSalidas();
});

navigator.mediaDevices?.addEventListener?.('devicechange', revisarSalidas);

// Si la pestaña se oculta en modo "Mantener", se corta para no quedar transmitiendo.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && estado.modo === 'mantener') parar();
  if (!document.hidden && estado.hablando) pedirPantallaEncendida();
});

// ---------- Inicio ----------
ui.volumen.value = leerPref('volumen', '1');
ui.volumenValor.textContent = `${Math.round(ui.volumen.value * 100)}%`;
ui.bajaLatencia.checked = leerPref('bajaLatencia', '0') === '1';
estado.idSalida = leerPref('salida', 'default');
fijarModo(leerPref('modo', 'alternar'));

if (!navigator.mediaDevices?.getUserMedia) {
  ui.estado.textContent = 'Este navegador no permite usar el micrófono (se necesita https o localhost)';
  ui.boton.disabled = true;
} else {
  revisarSalidas();
}

// ---------- Instalación (solo en la web; dentro de la app no tiene sentido) ----------
if (enApp) {
  $('instalar').hidden = true;
} else {
  let avisoInstalar = null;
  const botonPwa = $('boton-pwa');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    avisoInstalar = e;
    botonPwa.hidden = false;
  });
  botonPwa.addEventListener('click', async () => {
    if (!avisoInstalar) return;
    avisoInstalar.prompt();
    await avisoInstalar.userChoice;
    avisoInstalar = null;
    botonPwa.hidden = true;
  });
}

// En la app los archivos ya vienen dentro del APK: no hace falta el service worker.
if (!enApp && 'serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
