// Servidor estático mínimo para la vista previa (sin dependencias).
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', 'web');
const PUERTO = 3200;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(RAIZ, ruta);
  if (!archivo.startsWith(RAIZ + path.sep) || archivo.includes(`${path.sep}.claude${path.sep}`)) {
    res.writeHead(403).end('Prohibido');
    return;
  }
  fs.readFile(archivo, (err, datos) => {
    if (err) { res.writeHead(404).end('No encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(datos);
  });
}).listen(PUERTO, () => console.log(`Mic Parlante en http://localhost:${PUERTO}`));
