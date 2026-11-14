const sources = new Map([
  ['/api/financial-news/composite', 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EIXIC&region=US&lang=en-US'],
  ['/api/financial-news/nasdaq100', 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5ENDX&region=US&lang=en-US'],
]);
const cache = new Map();
const pending = new Map();
export async function financialNews(req, res, next) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith('/api/financial-news/')) return next();
  if (req.method !== 'GET' || !sources.has(path)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    let entry = cache.get(path);
    if (!entry || entry.expires <= Date.now()) {
      if (!pending.has(path)) pending.set(path, (async () => {
        const response = await fetch(sources.get(path), { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Feed unavailable');
        const body = await response.text();
        if (!body.includes('<rss')) throw new Error('Invalid feed');
        const result = { body, expires: Date.now() + 300000 };
        cache.set(path, result);
        return result;
      })().finally(() => pending.delete(path)));
      entry = await pending.get(path);
    }
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    res.end(entry.body);
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Fonte notizie temporaneamente non disponibile');
  }
}
export function financialNewsPlugin() {
  return { name: 'financial-news', configureServer(server) { server.middlewares.use(financialNews); }, configurePreviewServer(server) { server.middlewares.use(financialNews); } };
}
