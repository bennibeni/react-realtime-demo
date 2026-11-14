import { useCallback, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { readStored, searchBooks, storeValue } from '../services/discovery';

export default function BooksPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(() => { const value = readStored('favorite-books', []); return Array.isArray(value) ? value.filter((book) => book?.title && /^\/works\/OL\d+W$/.test(book.key)) : []; });
  const [storageError, setStorageError] = useState(false);
  const load = useCallback((signal) => searchBooks(query, signal), [query]);
  const { data, loading, error, retry } = useResource(load);
  function toggle(book) {
    const updated = favorites.some((item) => item.key === book.key) ? favorites.filter((item) => item.key !== book.key) : [...favorites, book];
    setFavorites(updated); setStorageError(!storeValue('favorite-books', updated));
  }
  const renderBook = (book) => <Book key={book.key} book={book} saved={favorites.some((item) => item.key === book.key)} toggle={() => toggle(book)} />;
  return <main className="container subpage">
    <header className="page-heading"><p className="eyebrow">LA TUA PROSSIMA LETTURA</p><h1>Libri — Open Library</h1><p className="meta">Cerca un titolo o un autore e conserva i libri che ti interessano.</p></header>
    <form className="discovery-form" onSubmit={(e) => { e.preventDefault(); if (input.trim()) { if (query === input.trim()) retry(); else setQuery(input.trim()); } }}>
      <label htmlFor="book-search">Titolo o autore</label>
      <input id="book-search" type="search" placeholder="Es. Italo Calvino" value={input} onChange={(e) => setInput(e.target.value)} maxLength={200} required />
      <button disabled={loading || !input.trim()}>Cerca</button>
    </form>
    {query && <section aria-label="Risultati ricerca">
      <h2>Risultati per “{query}”</h2>
      {loading && <p role="status">Ricerca in corso...</p>}
      {error && <div><p role="alert" className="feed-error">{error}</p><button onClick={retry}>Riprova</button></div>}
      {data && (data.length ? <div className="book-grid">{data.map(renderBook)}</div> : <p>Nessun libro trovato. Prova un altro titolo o autore.</p>)}
    </section>}
    <section className="favorites" aria-label="Libri preferiti"><h2>I tuoi preferiti ({favorites.length})</h2>
      {storageError && <p role="alert" className="feed-warning">Il browser non consente il salvataggio. I preferiti restano disponibili solo in questa pagina.</p>}
      {favorites.length ? <div className="book-grid">{favorites.map(renderBook)}</div> : <p className="meta">Aggiungi un libro dai risultati. I preferiti vengono salvati su questo dispositivo.</p>}
    </section>
    <p className="attribution">Dati e copertine: <a href="https://openlibrary.org/" target="_blank" rel="noreferrer">Open Library</a>. Le ricerche partono solo quando premi Cerca.</p>
  </main>;
}
function Book({ book, saved, toggle }) {
  const [failed, setFailed] = useState(false);
  return <article className="card book-card">
    {book.cover && !failed ? <img className="book-cover" src={book.cover} alt={`Copertina di ${book.title}`} loading="lazy" onError={() => setFailed(true)} /> : <div className="book-placeholder">Copertina non disponibile</div>}
    <h3><a href={`https://openlibrary.org${book.key}`} target="_blank" rel="noreferrer">{book.title}</a></h3>
    <p className="meta">{book.authors}</p><p className="meta">Prima pubblicazione: {book.year || 'non disponibile'}</p>
    <button className="secondary" aria-pressed={saved} onClick={toggle}>{saved ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}</button>
  </article>;
}
