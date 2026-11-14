import { test, expect } from '@playwright/test';

const feeds = [
  { path: '/meteo', title: 'Meteo a Roma', host: 'api.open-meteo.com', content: '20°C', data: { current_weather: { temperature: 20, windspeed: 8, winddirection: 90 } } },
  { path: '/notizie', title: 'Notizie', host: 'hacker-news.firebaseio.com', content: 'Notizia 1' },
  { path: '/aria', title: "Qualità dell'aria a Roma", host: 'air-quality-api.open-meteo.com', content: '24 AQI europeo', data: { current: { time: '2026-11-14T10:00', european_aqi: 24, pm2_5: 4.8, pm10: 7.8 } } },
  { path: '/cambio', title: 'Cambio EUR/USD', host: 'api.frankfurter.dev', content: '1 EUR = 1,1083 USD', data: [{ base: 'EUR', quote: 'USD', rate: 1.1083, date: '2026-11-14' }] },
  { path: '/terremoti', title: 'Terremoti', host: 'earthquake.usgs.gov', content: 'Test earthquake location', data: { features: [{ id: 'test1', properties: { mag: 3.4, place: 'Test earthquake location', time: 1794645007400 }, geometry: { coordinates: [12, 42, 8.9] } }] } },
];

test('home links all seven sections without starting API requests', async ({ page }, testInfo) => {
  const calls = [];
  page.on('request', (request) => { if (request.url().startsWith('https://')) calls.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('main .section-link')).toHaveCount(7);
  for (const path of [...feeds.map((feed) => feed.path), '/spazio', '/libri']) await expect(page.locator(`main a[href="${path}"]`)).toBeVisible();
  expect(calls).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.locator('main a[href="/meteo"]').click();
  await expect(page).toHaveURL(/\/meteo$/);
});

for (const fixture of feeds) test(`${fixture.path}: independent requests, pause, errors, offline and recovery`, async ({ page, context }, testInfo) => {
  let mode = 'ok';
  const hosts = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://**/*', async (route) => {
    const url = new URL(route.request().url());
    hosts.push(url.hostname);
    if (url.hostname !== fixture.host) return route.abort();
    if (mode === 'error') return route.fulfill({ status: 503, body: '{}' });
    if (fixture.path === '/notizie') {
      if (url.pathname.includes('newstories')) return route.fulfill({ json: Array.from({ length: 60 }, (_, i) => i + 1) });
      const id = Number(url.pathname.match(/item\/(\d+)/)[1]);
      if (mode === 'partial' && id === 3) return route.fulfill({ status: 503, body: '{}' });
      return route.fulfill({ json: { id, title: `Notizia ${id}`, by: 'demo', score: 10, time: 1700000000 } });
    }
    if (mode === 'empty' && fixture.path === '/terremoti') return route.fulfill({ json: { features: [] } });
    return route.fulfill({ json: fixture.data });
  });
  await page.route('**/api/financial-news/*', (route) => route.fulfill({ contentType: 'application/xml', body: '<rss><channel></channel></rss>' }));
  await page.goto(fixture.path);
  await expect(page.getByRole('heading', { name: fixture.title, exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText(fixture.content, { exact: fixture.path !== '/terremoti' })).toBeVisible();
  if (fixture.path === '/notizie') {
    await expect(page.locator('.news-item')).toHaveCount(50);
    await expect(page.getByRole('heading', { name: 'Ultime 50 Notizie Pubblicate' })).toBeVisible();
  }
  expect(new Set(hosts)).toEqual(new Set([fixture.host]));
  await expect(page.getByRole('button', { name: 'Aggiorna ora' })).toBeEnabled();
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(page.getByText('Aggiornamenti in pausa')).toBeVisible();
  if (fixture.path === '/notizie') {
    mode = 'partial';
    await page.getByRole('button', { name: 'Aggiorna ora' }).click();
    await expect(page.locator('.news-item')).toHaveCount(49);
    await expect(page.getByText(/1 notizie non recuperate/)).toBeVisible();
  }
  mode = 'error';
  await page.getByRole('button', { name: 'Aggiorna ora' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await expect(page.getByText(fixture.content, { exact: fixture.path !== '/terremoti' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Offline — aggiornamenti sospesi')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aggiorna ora' })).toBeDisabled();
  mode = 'ok';
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Riprendi', exact: true }).click();
  await expect(page.getByText('Dati aggiornati', { exact: true })).toBeVisible();
  if (fixture.path === '/terremoti') {
    mode = 'empty';
    await page.getByRole('button', { name: 'Aggiorna ora' }).click();
    await expect(page.getByText('Nessun evento disponibile nelle ultime 24 ore.')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('feed.png'), fullPage: true });
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.locator('main .section-link')).toHaveCount(7);
});

test('air quality scale shows category boundaries, zero and values above its visual range', async ({ page }, testInfo) => {
  let aqi = 24;
  await page.route('https://air-quality-api.open-meteo.com/**', (route) => route.fulfill({ json: { current: { time: '2026-11-14T10:00', european_aqi: aqi, pm2_5: 4.8, pm10: 7.8 } } }));
  await page.goto('/aria');
  await expect(page.getByRole('img', { name: /AQI europeo 24: qualità discreta/ })).toBeVisible();
  await expect(page.locator('.aqi-current')).toContainText('Discreta');
  await page.screenshot({ path: testInfo.outputPath('air-scale.png'), fullPage: true });
  for (const [value, label] of [[0, 'Buona'], [20, 'Buona'], [20.1, 'Discreta'], [40, 'Discreta'], [40.1, 'Moderata'], [60, 'Moderata'], [60.1, 'Scarsa'], [80, 'Scarsa'], [80.1, 'Molto scarsa'], [100, 'Molto scarsa'], [100.1, 'Estremamente scarsa'], [180, 'Estremamente scarsa']]) {
    aqi = value;
    await page.getByRole('button', { name: 'Aggiorna ora' }).click();
    await expect(page.locator('.aqi-current strong')).toHaveText(label);
    await expect(page.locator('.aqi-marker > span')).toHaveText(value.toLocaleString('it-IT'));
  }
  await expect(page.locator('.aqi-marker')).toHaveAttribute('style', 'left: 100%;');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
