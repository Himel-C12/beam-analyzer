import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(ROOT, '..');

// Tiny .env loader: no dependency required.
function loadEnv(file = path.join(PROJECT, '.env')) {
  try {
    const text = fs.readFileSync(path.resolve(file), 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {}
}
loadEnv();

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.STRUCTURECALCS_API_KEY || '';
const PUBLIC = path.join(PROJECT, 'public');
const API = 'https://api.structurecalcs.com/v1';
const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon'
};

function json(res, status, data, headers={}) {
  res.writeHead(status, {'Content-Type': MIME['.json'], 'Cache-Control':'no-store', ...headers});
  res.end(JSON.stringify(data));
}
function text(res, status, data) { res.writeHead(status, {'Content-Type':'text/plain; charset=utf-8'}); res.end(data); }
async function body(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if (size > 1024*1024) throw Object.assign(new Error('Request body too large'), {status:413}); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON'), {status:400}); }
}
async function upstream(pathname, payload) {
  const headers = {'Content-Type':'application/json'};
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  return fetch(`${API}${pathname}`, {method:'POST', headers, body:JSON.stringify(payload), signal:AbortSignal.timeout(20000)});
}
async function proxy(req, res, pathname) {
  try {
    const payload = await body(req);
    const r = await upstream(pathname, payload);
    const raw = await r.text();
    const headers = {};
    for (const h of ['retry-after','x-ratelimit-remaining','x-ratelimit-window']) {
      const v = r.headers.get(h); if (v) headers[h] = v;
    }
    res.writeHead(r.status, {'Content-Type': r.headers.get('content-type') || MIME['.json'], 'Cache-Control':'no-store', ...headers});
    res.end(raw);
  } catch (e) {
    json(res, e.status || 502, {code:e.status===400?'invalid_json':e.status===413?'payload_too_large':'upstream_unreachable', detail:e.message || 'Could not reach StructureCalcs.'});
  }
}
function staticFile(req, res) {
  let pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname === '/') pathname = '/index.html';
  const decoded = decodeURIComponent(pathname);
  const candidate = path.resolve(PUBLIC, '.' + decoded);
  if (!candidate.startsWith(PUBLIC + path.sep) && candidate !== PUBLIC) return text(res, 403, 'Forbidden');
  fs.readFile(candidate, (err, data) => {
    if (!err) { res.writeHead(200, {'Content-Type': MIME[path.extname(candidate).toLowerCase()] || 'application/octet-stream'}); return res.end(data); }
    // SPA fallback for client-side routes.
    fs.readFile(path.join(PUBLIC,'index.html'), (e, fallback) => e ? text(res,404,'Not found') : (res.writeHead(200, {'Content-Type':MIME['.html']}), res.end(fallback)));
  });
}
const server = http.createServer(async (req,res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (req.method === 'GET' && pathname === '/api/health') return json(res,200,{ok:true,configured:Boolean(API_KEY),api:'structurecalcs',port:PORT});
  if (req.method === 'POST' && pathname === '/api/beam/solve') return proxy(req,res,'/beam/solve');
  if (req.method === 'POST' && pathname === '/api/beam/diagram') return proxy(req,res,'/beam/diagram');
  if (req.method !== 'GET' && req.method !== 'HEAD') return text(res,405,'Method Not Allowed');
  staticFile(req,res);
});
server.listen(PORT, () => console.log(`Beam Analyzer running at http://localhost:${PORT}`));
