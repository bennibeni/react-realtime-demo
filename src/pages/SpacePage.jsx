import { useCallback, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { loadApod } from '../services/discovery';

function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export default function SpacePage() {
  const [date, setDate] = useState(today);
  const load = useCallback((signal) => loadApod(date, signal), [date]);
  const { data, loading, error, retry } = useResource(load);
  return <main className="container subpage">
    <header className="page-heading"><p className="eyebrow">SCOPRI OGNI GIORNO</p><h1>Spazio — NASA</h1><p className="meta">Astronomy Picture of the Day: una finestra sull'universo.</p></header>
    <form className="discovery-form" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="apod-date">Esplora una data</label>
      <input id="apod-date" type="date" min="1995-06-16" max={today()} value={date} onChange={(e) => { if (e.target.value >= '1995-06-16' && e.target.value <= today()) setDate(e.target.value); }} />
      <button type="button" className="secondary" onClick={() => setDate(today())}>Oggi</button>
    </form>
    {loading && <p role="status">Caricamento del contenuto NASA...</p>}
    {error && <div className="card"><p role="alert" className="feed-error">{error}</p><button onClick={retry}>Riprova</button><p className="attribution"><a href="https://apod.nasa.gov/" target="_blank" rel="noreferrer">Visita il sito ufficiale APOD</a></p></div>}
    {data && <article className="card apod-card">
      <p className="meta">{data.date}</p><h2>{data.title}</h2>
      {data.warning && <p className="feed-warning" role="status">{data.warning}</p>}
      {data.image ? <a href={data.image} target="_blank" rel="noreferrer" aria-label="Apri immagine a piena risoluzione"><img className="apod-image" src={data.image} alt={data.title} onError={(e) => { e.currentTarget.hidden = true; }} /></a> : <p className="meta">Contenuto multimediale disponibile sulla pagina originale.</p>}
      <details><summary>Leggi la spiegazione originale</summary><p className="apod-explanation">{data.explanation || 'Spiegazione non disponibile.'}</p></details>
      {data.copyright && <p className="attribution">Crediti: {data.copyright}</p>}
      <p className="attribution">Fonte: NASA APOD · {data.link && <a href={data.link} target="_blank" rel="noreferrer">Apri il contenuto originale</a>}</p>
    </article>}
    <p className="meta page-note">Il contenuto viene conservato per 24 ore per ridurre le richieste. Testi nella lingua originale.</p>
  </main>;
}
