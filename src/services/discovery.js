const memory = new Map();
export function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function storeValue(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
async function cachedJson(url, signal, ttl) {
  const cached = memory.get(url) ?? readStored(`api:${url}`, null);
  if (cached?.expires > Date.now()) return cached.data;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(response.status === 429 ? 'Limite di richieste raggiunto. Riprova più tardi.' : `Servizio non disponibile (HTTP ${response.status}). Riprova più tardi.`);
  const data = await response.json();
  signal.throwIfAborted();
  const entry = { data, expires: Date.now() + ttl };
  memory.set(url, entry);
  storeValue(`api:${url}`, entry);
  return data;
}
async function loadScienceApod(date, signal) {
  const [year, month, day] = date.split('-');
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)).toLowerCase();
  const prefix = `apod-${year}-${monthName}-${Number(day)}-`;
  const params = new URLSearchParams({ search: `apod ${year} ${monthName} ${Number(day)}`, per_page: '20', _fields: 'slug,link,title,content' });
  const posts = await cachedJson(`https://science.nasa.gov/wp-json/wp/v2/image-article?${params}`, signal, 86400000);
  const post = Array.isArray(posts) && posts.find((item) => item.slug?.startsWith(prefix));
  if (!post) throw new Error('Contenuto NASA Science non disponibile per questa data');
  const document = new DOMParser().parseFromString(post.content?.rendered || '', 'text/html');
  const text = (element) => {
    if (!element) return '';
    element.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    return element.textContent.replace(/[\t ]+/g, ' ').trim();
  };
  const titleDocument = new DOMParser().parseFromString(post.title?.rendered || '', 'text/html');
  const title = text(document.querySelector('h1')) || text(titleDocument.body);
  const image = safeUrl(document.querySelector('.media-detail-hero img, figure img')?.getAttribute('src'));
  const link = safeUrl(post.link);
  const creditRow = Array.from(document.querySelectorAll('tr')).find((row) => /^Credit:/i.test(text(row.querySelector('th'))));
  if (!title || !image || !link || !new URL(link).hostname.endsWith('.nasa.gov')) throw new Error('Contenuto NASA Science incompleto');
  return { title, date, image, link, type: 'image', explanation: text(document.querySelector('.media-detail-hero__description')).replace(/^Explanation:\s*/i, ''), copyright: text(creditRow?.querySelector('td')), warning: null };
}
export async function loadApod(date, signal) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) throw new Error('Data non valida');
  let data;
  try {
    data = await cachedJson(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=${encodeURIComponent(date)}`, signal, 86400000);
  } catch (error) {
    signal.throwIfAborted();
    try { return await loadScienceApod(date, signal); } catch { signal.throwIfAborted(); throw error; }
  }
  if (!data.title || !data.date) throw new Error('Risposta NASA non valida');
  const image = data.media_type === 'image' ? safeUrl(data.hdurl || data.url) : null;
  const placeholder = image?.includes('/assets/images/nasa-logo') || data.title === 'NASA Science';
  if (placeholder) {
    try { return await loadScienceApod(date, signal); } catch { signal.throwIfAborted(); }
  }
  // The migrated API can return a post permalink in url instead of an image.
  const imageUrl = !placeholder && image && (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(image) || data.hdurl) ? image : null;
  const officialPage = `https://apod.nasa.gov/apod/ap${data.date.slice(2).replaceAll('-', '')}.html`;
  return { title: placeholder ? `Contenuto APOD del ${data.date}` : data.title, date: data.date, explanation: data.explanation || '', image: imageUrl,
    warning: placeholder ? 'NASA ha restituito il testo, ma i dati dell’immagine non sono disponibili. Consulta la pagina ufficiale.' : null,
    link: placeholder ? officialPage : safeUrl(data.permalink) || safeUrl(data.url) || officialPage, copyright: data.copyright || '', type: data.media_type };
}
let nextBookRequest = 0;
export async function searchBooks(query, signal) {
  if (!query.trim()) return null;
  // Keep anonymous searches below one request per second, including rapid submissions.
  const wait = Math.max(0, nextBookRequest - Date.now());
  nextBookRequest = Date.now() + wait + 1100;
  if (wait) await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, wait);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
  signal.throwIfAborted();
  const params = new URLSearchParams({ q: query.trim(), limit: '12', fields: 'key,title,author_name,first_publish_year,cover_i', lang: 'it' });
  const data = await cachedJson(`https://openlibrary.org/search.json?${params}`, signal, 3600000);
  if (!Array.isArray(data.docs)) throw new Error('Risposta Open Library non valida');
  return data.docs.filter((book) => /^\/works\/OL\d+W$/.test(book.key) && book.title).map((book) => ({
    key: book.key, title: book.title, authors: Array.isArray(book.author_name) ? book.author_name.join(', ') : 'Autore non disponibile',
    year: book.first_publish_year, cover: Number.isInteger(book.cover_i) ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg?default=false` : null,
  }));
}
