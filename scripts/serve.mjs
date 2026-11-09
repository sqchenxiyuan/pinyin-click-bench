import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  try {
    const url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = url.replace(/^\/pinyin-click-bench\/?/, '').replace(/^\//, '') || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep)) throw new Error('Forbidden');
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port}/pinyin-click-bench/`));
