import { useState } from 'react';
import FinancialNews from '../components/FinancialNews';
import AirQualityScale from '../components/AirQualityScale';
import { usePolling } from '../hooks/usePolling';
import { loadWeather, loadNews, loadAirQuality, loadExchangeRate, loadEarthquakes } from '../services/realtime';

const sources = {
  meteo: { title: 'Meteo a Roma', interval: 600000, maxRetryInterval: 1800000, label: 'Ogni 10 minuti', load: loadWeather },
  notizie: { title: 'Notizie', interval: 60000, maxRetryInterval: 300000, label: 'Ogni minuto', load: loadNews },
  aria: { title: "Qualità dell'aria a Roma", interval: 1800000, maxRetryInterval: 7200000, label: 'Ogni 30 minuti', load: loadAirQuality },
  cambio: { title: 'Cambio EUR/USD', interval: 21600000, maxRetryInterval: 86400000, label: 'Ogni 6 ore', load: loadExchangeRate },
  terremoti: { title: 'Terremoti', interval: 300000, maxRetryInterval: 1800000, label: 'Ogni 5 minuti', load: loadEarthquakes },
};
export default function FeedPage({ source }) {
  const config = sources[source];
  const [isPaused, setIsPaused] = useState(false);
  const feed = usePolling(config.load, { paused: isPaused, interval: config.interval, maxRetryInterval: config.maxRetryInterval });
  const weather = feed.data;
  const news = feed.data?.items ?? [];
  const status = !feed.online || feed.error ? 'error' : feed.loading ? 'loading' : 'connected';
  return <main className="container subpage">
    <header className="header">
      <div><h1>{config.title}</h1><p className="meta">{config.label} · Cicli completati: {feed.cycles}</p></div>
      <div className="controls">
        <div className="status-badge" role="status"><span className={`dot ${status}`}></span>
          {!feed.online ? 'Offline — aggiornamenti sospesi' : feed.loading ? 'Sincronizzazione...' : feed.error ? 'Errore di aggiornamento' : isPaused ? 'Aggiornamenti in pausa' : 'Dati aggiornati'}
        </div>
        <button className="secondary" onClick={() => setIsPaused((value) => !value)}>{isPaused ? 'Riprendi' : 'Pausa'}</button>
        <button onClick={feed.refresh} disabled={feed.loading || !feed.online}>Aggiorna ora</button>
      </div>
    </header>
    {source === 'meteo' && (
        <section className="card">
          <h2>
            <span>Meteo in tempo reale (Roma)</span>
            <span>Open-Meteo API</span>
          </h2>
          <FeedStatus feed={feed} />
          {weather ? (
            <>
              <div className="big-value">{weather.temperature}°C</div>
              <p className="meta">
                Vento: {weather.windspeed} km/h • Direzione: {weather.winddirection}°
              </p>
            </>
          ) : (
            <p className="meta">{feed.loading ? 'Caricamento dati meteo...' : 'Dati meteo non disponibili'}</p>
          )}
        </section>

    )}
    {source === 'notizie' && (
      <section className="card">
        <h2>
          <span>Ultime 50 Notizie Pubblicate</span>
          <span>Hacker News Live API</span>
        </h2>
        <FeedStatus feed={feed} />
        {news.length > 0 ? (
          <ul className="news-list">
            {news.map((item) => (
              <li key={item.id} className="news-item">
                <div>
                  <a
                    href={item.url || `https://news.ycombinator.com/item?id=${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.title}
                  </a>
                  <div className="meta" style={{ marginTop: '0.25rem' }}>
                    Autore: {item.by} • Score: {item.score}
                  </div>
                </div>
                <span className="news-time">
                  {new Date(item.time * 1000).toLocaleTimeString('it-IT')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">{feed.loading ? 'Caricamento notizie...' : feed.data ? 'Nessuna notizia disponibile' : 'Notizie non disponibili'}</p>
        )}
      </section>
    )}
    {source === 'aria' && (
        <section className="card" aria-label="Qualità dell'aria">
          <h2><span>Qualità dell'aria (Roma)</span><span>Ogni 30 min</span></h2>
          <FeedStatus feed={feed} />
          {feed.data ? <>
            <div className="big-value">{feed.data.european_aqi} <small>AQI europeo</small></div>
            <AirQualityScale value={feed.data.european_aqi} />
            <p className="meta">PM2.5: {feed.data.pm2_5} µg/m³ · PM10: {feed.data.pm10} µg/m³</p>
            <p className="meta">Ora del dato (Roma): {feed.data.time.replace('T', ' ')}</p>
            <p className="meta">Stima da modello atmosferico.</p>
          </> : <EmptyFeed feed={feed} />}
          <p className="attribution">Fonte: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">CAMS ENSEMBLE</a> · CC BY 4.0</p>
        </section>
    )}
    {source === 'cambio' && (
        <section className="card" aria-label="Cambio EUR USD">
          <h2><span>Cambio EUR/USD</span><span>Ogni 6 ore</span></h2>
          <FeedStatus feed={feed} />
          {feed.data ? <>
            <div className="exchange-value">1 EUR = {feed.data.rate.toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} USD</div>
            <p className="meta">1 USD = {(1 / feed.data.rate).toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} EUR</p>
            <p className="meta">Data del cambio: {feed.data.date}</p>
            <p className="meta">Cambio di riferimento, aggiornato giornalmente.</p>
          </> : <EmptyFeed feed={feed} />}
          <p className="attribution">Fonte: <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a></p>
        </section>
    )}
    {source === 'terremoti' && (
      <section className="card earthquake-card" aria-label="Terremoti">
        <h2><span>Ultimi terremoti nel mondo</span><span>USGS · Ogni 5 min</span></h2>
        <p className="meta section-description">Ultimi 10 eventi dal feed M 2.5+, nelle ultime 24 ore.</p>
        <FeedStatus feed={feed} />
        {feed.data?.length ? <ul className="news-list">
          {feed.data.map((event) => <li className="news-item quake-item" key={event.id}>
            <div>
              <a href={event.url} target="_blank" rel="noreferrer">M {event.magnitude.toLocaleString('it-IT', { maximumFractionDigits: 1 })} · {event.place}</a>
              <p className="meta">Profondità: {Number.isFinite(event.depth) ? `${event.depth.toLocaleString('it-IT', { maximumFractionDigits: 1 })} km` : 'non disponibile'}</p>
            </div>
            <time className="news-time" dateTime={new Date(event.time).toISOString()}>{new Date(event.time).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} (Roma)</time>
          </li>)}
        </ul> : feed.data ? <p className="meta">Nessun evento disponibile nelle ultime 24 ore.</p> : <EmptyFeed feed={feed} />}
        <p className="attribution">Fonte: <a href="https://earthquake.usgs.gov/" target="_blank" rel="noreferrer">USGS Earthquake Hazards Program</a></p>
      </section>

    )}
    {source === 'cambio' && <FinancialNews paused={isPaused} />}
  </main>;
}

function FeedStatus({ feed }) {
  return <div className="feed-status" aria-live="polite">
    {feed.error && <p className="feed-error" role="alert">{feed.error}. {feed.data && 'Sono mostrati gli ultimi dati disponibili.'}</p>}
    {feed.data?.warning && <p className="feed-warning" role="status">{feed.data.warning}</p>}
    {feed.updatedAt && <p className="meta">Ultimo aggiornamento: {feed.updatedAt.toLocaleTimeString('it-IT')}</p>}
  </div>;
}

function EmptyFeed({ feed }) {
  return <p className="meta">{feed.loading ? 'Caricamento dati...' : 'Dati non disponibili'}</p>;
}
