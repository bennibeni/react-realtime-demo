import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { financialNews } from './financial-news.js';
const root = resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  financialNews(req, res, async () => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + path);
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
      let body, extension;
      try { body = await readFile(file); extension = extname(file); }
      catch {
        if (extname(path) || path.startsWith('/api/')) { res.writeHead(404); res.end(); return; }
        body = await readFile(resolve(root, 'index.html')); extension = '.html';
      }
      res.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500); res.end('Server error'); }
  });
}).listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1', () => console.log('Server pronto: http://127.0.0.1:' + (process.env.PORT || 4173)));
