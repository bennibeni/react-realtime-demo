import { usePolling } from '../hooks/usePolling';
import { loadFinancialNews } from '../services/financial-news';
export default function FinancialNews({ paused }) {
  const feed = usePolling(loadFinancialNews, { paused, interval: 900000, maxRetryInterval: 3600000 });
  return <section className="card financial-news" aria-label="Notizie finanziarie">
    <h2><span>Ultime notizie Nasdaq</span><span>Nasdaq Composite e Nasdaq-100</span></h2>
    <p className="meta section-description">Ultime 10 notizie dai feed Nasdaq Composite e Nasdaq-100 di Yahoo Finance. Titoli nella lingua originale · Aggiornamento ogni 15 minuti.</p>
    <p className="meta section-description">In primo piano e in rosso: titoli che citano Moderna (MRNA), Nvidia (NVDA) o Anthropic. In ciascun gruppo, le notizie più recenti vengono prima.</p>
    <div className="controls financial-controls">
      <button className="secondary" onClick={feed.refresh} disabled={feed.loading || !feed.online}>Aggiorna notizie</button>
      <span className="meta" role="status">{!feed.online ? 'Offline' : feed.loading ? 'Caricamento notizie finanziarie...' : paused ? 'Notizie in pausa' : feed.updatedAt ? `Aggiornate alle ${feed.updatedAt.toLocaleTimeString('it-IT')}` : ''}</span>
    </div>
    {feed.error && <p className="feed-error" role="alert">{feed.error}. {feed.data && 'Sono mostrati gli ultimi dati disponibili.'}</p>}
    {feed.data?.warning && <p className="feed-warning">{feed.data.warning}</p>}
    {feed.data?.items.length ? <ul className="news-list">{feed.data.items.map((item) => <li className={`news-item${item.companies.length ? ' news-priority' : ''}`} key={item.url}>
      <div>{item.companies.length > 0 && <p className="priority-label">In primo piano · {item.companies.join(' · ')}</p>}<a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><p className="meta">{item.source}</p></div>
      <time className="news-time" dateTime={new Date(item.time).toISOString()}>{new Date(item.time).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} (Roma)</time>
    </li>)}</ul> : !feed.loading && !feed.error && <p className="meta">Nessuna notizia disponibile.</p>}
    <p className="attribution">Fonte: Yahoo Finance · <a href="https://finance.yahoo.com/quote/%5EIXIC/news/" target="_blank" rel="noreferrer">Nasdaq Composite</a> · <a href="https://finance.yahoo.com/quote/%5ENDX/news/" target="_blank" rel="noreferrer">Nasdaq-100</a>. Gli articoli possono richiedere un abbonamento presso l’editore.</p>
  </section>;
}
