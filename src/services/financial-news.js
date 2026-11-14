const watchedCompanies = [
  { name: 'Moderna', pattern: /\b(?:moderna|mrna)\b/i },
  { name: 'Nvidia', pattern: /\b(?:nvidia|nvda)\b/i },
  { name: 'Anthropic', pattern: /\banthropic\b/i },
];

export async function loadFinancialNews(signal) {
  const sources = [{ id: 'composite', name: 'Yahoo Finance · Nasdaq Composite', hosts: ['finance.yahoo.com', 'www.barchart.com', 'www.investors.com', 'www.zacks.com'] }, { id: 'nasdaq100', name: 'Yahoo Finance · Nasdaq-100', hosts: ['finance.yahoo.com', 'www.barchart.com', 'www.investors.com', 'www.zacks.com'] }];
  const results = await Promise.allSettled(sources.map(async (source) => {
    const response = await fetch(`/api/financial-news/${source.id}`, { signal });
    if (!response.ok) throw new Error(`${source.name} non disponibile`);
    const xml = new DOMParser().parseFromString(await response.text(), 'text/xml');
    if (xml.querySelector('parsererror') || !xml.querySelector('rss')) throw new Error(`Feed ${source.name} non valido`);
    return Array.from(xml.querySelectorAll('item')).map((item) => {
      const title = item.querySelector('title')?.textContent.trim();
      const link = item.querySelector('link')?.textContent.trim();
      const time = Date.parse(item.querySelector('pubDate')?.textContent);
      try {
        const url = new URL(link);
        if (!title || !Number.isFinite(time) || url.protocol !== 'https:' || !source.hosts.includes(url.hostname)) return null;
        return { title, url: url.href, time, source: source.name, companies: watchedCompanies.filter((company) => company.pattern.test(title)).map((company) => company.name) };
      } catch { return null; }
    }).filter(Boolean);
  }));
  signal.throwIfAborted();
  if (results.every((result) => result.status === 'rejected')) throw new Error('Notizie finanziarie temporaneamente non disponibili');
  const failed = results.flatMap((result, index) => result.status === 'rejected' ? [sources[index].name] : []);
  const items = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  return { items: [...new Map(items.map((item) => [item.url, item])).values()].sort((a, b) => Number(b.companies.length > 0) - Number(a.companies.length > 0) || b.time - a.time).slice(0, 10), warning: failed.length ? `Fonte non disponibile: ${failed.join(', ')}. Sono mostrate le altre notizie.` : null };
}
