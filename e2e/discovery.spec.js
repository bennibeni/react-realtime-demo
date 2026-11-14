import { test, expect } from '@playwright/test';

test('space page, date archive, cache, video and API failures', async ({ page }, testInfo) => {
  await page.route('https://science.nasa.gov/**', (route) => route.fulfill({ status: 503, body: '{}' }));
  let calls = 0;
  let mode = 'image';
  await page.route('https://api.nasa.gov/**', async (route) => {
    calls++;
    if (mode === 'error') return route.fulfill({ status: 500, body: '{}' });
    const date = new URL(route.request().url()).searchParams.get('date');
    return route.fulfill({ json: { title: 'A galaxy to explore', date, media_type: mode, explanation: 'An astronomical explanation.', copyright: 'Test author', url: mode === 'image' ? 'https://example.org/space.png' : 'https://example.org/video' } });
  });
  await page.route('https://example.org/space.png', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#172554"/><circle cx="400" cy="200" r="90" fill="#38bdf8"/></svg>' }));
  await page.goto('/spazio');
  await expect(page.getByRole('heading', { name: 'Spazio — NASA' })).toBeVisible();
  await expect(page.getByRole('img')).toBeVisible();
  await page.getByText('Leggi la spiegazione originale').click();
  await expect(page.getByText('An astronomical explanation.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img')).toBeVisible();
  expect(calls).toBe(1);
  mode = 'video';
  await page.getByLabel('Esplora una data').fill('2020-01-02');
  await expect(page.getByText('Contenuto multimediale disponibile sulla pagina originale.')).toBeVisible();
  mode = 'error';
  await page.getByLabel('Esplora una data').fill('2020-01-03');
  await expect(page.getByRole('alert')).toContainText('HTTP 500');
  mode = 'image';
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.getByRole('img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('space.png'), fullPage: true });
  await page.getByRole('link', { name: 'Libri', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Libri — Open Library' })).toBeVisible();
});

test('NASA migration recovers correct image, date and credits', async ({ page }, testInfo) => {
  await page.route('https://api.nasa.gov/**', (route) => route.fulfill({ json: {
    title: 'NASA Science', date: new URL(route.request().url()).searchParams.get('date'), media_type: 'image',
    hdurl: 'https://science.nasa.gov/assets/images/nasa-logo.png', explanation: 'Old text',
  } }));
  await page.route('https://science.nasa.gov/wp-json/**', (route) => route.fulfill({ json: [
    { slug: 'apod-2026-november-13-wrong-day', title: { rendered: 'Wrong date' } },
    { slug: 'apod-2026-november-14-apollo', link: 'https://science.nasa.gov/image-article/apod-2026-november-14-apollo/', title: { rendered: 'Apollo' }, content: { rendered: '<figure><img src="https://example.org/apollo.png"></figure><h1>Apollo 12 and Surveyor 3</h1><p class="media-detail-hero__description">Explanation: Lunar image.<br>Second line.</p><table><tr><th>Credit:</th><td>Apollo 12 &amp; Kevin Frank</td></tr></table>' } },
  ] }));
  await page.route('https://example.org/apollo.png', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#64748b"/></svg>' }));
  await page.goto('/spazio');
  await page.getByLabel('Esplora una data').fill('2026-11-14');
  await expect(page.getByRole('heading', { name: 'Apollo 12 and Surveyor 3' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Apollo 12 and Surveyor 3' })).toBeVisible();
  await expect(page.getByText('Crediti: Apollo 12 & Kevin Frank')).toBeVisible();
  await expect(page.getByText(/NASA ha restituito il testo/)).toHaveCount(0);
  await page.getByText('Leggi la spiegazione originale').click();
  await expect(page.getByText(/Lunar image/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('apod-recovery.png'), fullPage: true });
});

test('books search only on submit, favorites persistence, missing covers, empty and errors', async ({ page }, testInfo) => {
  let calls = 0;
  let mode = 'ok';
  await page.route('https://openlibrary.org/search.json?**', async (route) => {
    calls++;
    if (mode === 'error') return route.fulfill({ status: 429, body: '{}' });
    return route.fulfill({ json: { docs: mode === 'empty' ? [] : [{ key: '/works/OL15297W', title: 'Le città invisibili', author_name: ['Italo Calvino'], first_publish_year: 1972 }] } });
  });
  await page.goto('/libri');
  await page.getByLabel('Titolo o autore').fill('Italo Calvino');
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Cerca', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Le città invisibili' })).toBeVisible();
  await expect(page.getByText('Copertina non disponibile')).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi ai preferiti' }).click();
  await expect(page.getByRole('heading', { name: 'I tuoi preferiti (1)' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Le città invisibili' })).toBeVisible();
  expect(calls).toBe(1);
  mode = 'empty';
  await page.getByLabel('Titolo o autore').fill('nothing');
  await page.getByRole('button', { name: 'Cerca', exact: true }).click();
  await expect(page.getByText(/Nessun libro trovato/)).toBeVisible();
  mode = 'error';
  await page.getByLabel('Titolo o autore').fill('failure');
  await page.getByRole('button', { name: 'Cerca', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Limite di richieste');
  await page.getByRole('button', { name: 'Rimuovi dai preferiti' }).click();
  await expect(page.getByRole('heading', { name: 'I tuoi preferiti (0)' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('books.png'), fullPage: true });
});
