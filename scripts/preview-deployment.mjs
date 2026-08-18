/**
 * Runs the Vercel serverless entry (api/index.mjs) behind a plain Node HTTP
 * server, mimicking how Vercel invokes it: every /api/* request is handed to the
 * handler with the ORIGINAL path still on req.url, and non-API paths fall back
 * to index.html the way the SPA rewrite does.
 *
 * This lets the full API test suite run against the deployment code path.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handler = (await import(new URL('../api/index.mjs', import.meta.url))).default;
const DIST = path.join(ROOT, 'client/dist');
const PORT = Number(process.argv[2] || 5052);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Rewrite rule 1: /api/(.*) -> the serverless function
  if (url.pathname.startsWith('/api')) {
    // Vercel's Node runtime pre-parses JSON bodies and sets req.body before the
    // function runs. Emulate that with PREPARSE=1 to prove the app copes.
    if (process.env.PREPARSE === '1' && /json/.test(req.headers['content-type'] || '')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
    }
    return handler(req, res);
  }

  // Static files, then rewrite rule 2: SPA fallback to index.html
  const filePath = path.join(DIST, url.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    return fs.createReadStream(filePath).pipe(res);
  }

  const index = path.join(DIST, 'index.html');
  if (!fs.existsSync(index)) {
    res.statusCode = 500;
    return res.end('client/dist missing — run `npm run build` first');
  }
  res.setHeader('Content-Type', 'text/html');
  return fs.createReadStream(index).pipe(res);
});

server.listen(PORT, () => console.log(`[vercel-sim] listening on http://localhost:${PORT}`));
