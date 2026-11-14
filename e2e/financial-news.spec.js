import { test, expect } from '@playwright/test';
test('financial headlines stay independent from exchange rates and tolerate partial failure', async ({ page }, testInfo) => {
  let mode = 'ok';
  await page.route('https://api.frankfurter.dev/**', (route) => route.fulfill({ json: [{ base: 'EUR', quote: 'USD', date: '2026-11-14', rate: 1.1 }] }));
  await page.route('**/api/financial-news/*', (route) => {
    const fed = route.request().url().endsWith('/nasdaq100');
    if (mode === 'error' || (mode === 'partial' && fed)) return route.fulfill({ status: 502, body: '' });
    const host = 'finance.yahoo.com';
    return route.fulfill({ contentType: 'application/xml', body: `<rss><channel><item><title>${fed ? 'Nasdaq-100 update' : 'Nasdaq Composite update'}</title><link>https://${host}/news/${fed ? "ndx" : "ixic"}</link><pubDate>Fri, 13 Nov 2026 12:00:00 GMT</pubDate></item><item><title>Unsafe</title><link>javascript:alert(1)</link><pubDate>Fri, 13 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>` });
  });
  await page.goto('/cambio');
  const panel = page.getByRole('region', { name: 'Notizie finanziarie' });
  await expect(panel.getByRole('link', { name: 'Nasdaq Composite update' })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Nasdaq-100 update' })).toBeVisible();
  await expect(panel.getByText('Unsafe')).toHaveCount(0);
  await expect(page.getByText('1 EUR = 1,1000 USD')).toBeVisible();
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(panel.getByText('Notizie in pausa')).toBeVisible();
  mode = 'partial';
  await panel.getByRole('button', { name: 'Aggiorna notizie' }).click();
  await expect(panel.getByText(/Fonte non disponibile: Yahoo Finance · Nasdaq-100/)).toBeVisible();
  await expect(panel.locator('.news-item')).toHaveCount(1);
  mode = 'error';
  await panel.getByRole('button', { name: 'Aggiorna notizie' }).click();
  await expect(panel.getByRole('alert')).toContainText('Notizie finanziarie temporaneamente non disponibili');
  await expect(panel.locator('.news-item')).toHaveCount(1);
  await expect(page.getByText('1 EUR = 1,1000 USD')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('financial-news.png'), fullPage: true });
});

test('watched companies rank before newer headlines and beyond the first ten', async ({ page }, testInfo) => {
  await page.route('https://api.frankfurter.dev/**', (route) => route.fulfill({ json: [{ base: 'EUR', quote: 'USD', date: '2026-11-14', rate: 1.1 }] }));
  const titles = [...Array.from({ length: 12 }, (_, i) => `Market update ${i}`), 'NVDA earnings', 'Moderna outlook', 'Anthropic partnership', 'NVIDIA innovation', 'MRNA results', 'Supermoderna unrelated'];
  const xml = '<rss><channel>' + titles.map((title, i) => `<item><title>${title}</title><link>https://finance.yahoo.com/news/item${i}</link><pubDate>${new Date(Date.UTC(2026, 10, 14, 12) - i * 60000).toUTCString()}</pubDate></item>`).join('') + '</channel></rss>';
  await page.route('**/api/financial-news/*', (route) => route.fulfill({ contentType: 'application/xml', body: xml }));
  await page.goto('/cambio');
  const panel = page.getByRole('region', { name: 'Notizie finanziarie' });
  await expect(panel.locator('.news-item')).toHaveCount(10);
  await expect(panel.locator('.news-priority')).toHaveCount(5);
  await expect(panel.locator('.news-item > div > a')).toHaveText(['NVDA earnings', 'Moderna outlook', 'Anthropic partnership', 'NVIDIA innovation', 'MRNA results', 'Market update 0', 'Market update 1', 'Market update 2', 'Market update 3', 'Market update 4']);
  await expect(panel.locator('.news-priority a').first()).toHaveCSS('color', 'rgb(252, 165, 165)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('priority-news.png'), fullPage: true });
});
