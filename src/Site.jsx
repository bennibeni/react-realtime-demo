import { lazy, Suspense } from 'react';
import App from './App';
import { sections } from './sections';
const SpacePage = lazy(() => import('./pages/SpacePage'));
const BooksPage = lazy(() => import('./pages/BooksPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
export default function Site() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const source = path.slice(1);
  const isFeed = ['meteo', 'notizie', 'aria', 'cambio', 'terremoti'].includes(source);
  return <>
    <nav className="site-nav container" aria-label="Navigazione principale">
      {[{ path: '/', title: 'Dashboard' }, ...sections].map(({ path: href, title }) => <a key={href} href={href} aria-current={path === href ? 'page' : undefined}>{title}</a>)}
    </nav>
    <Suspense fallback={<p className="container" role="status">Caricamento pagina...</p>}>
      {path === '/' ? <App /> : isFeed ? <FeedPage key={source} source={source} /> : path === '/spazio' ? <SpacePage /> : path === '/libri' ? <BooksPage /> : <main className="container"><h1>Pagina non trovata</h1><a href="/">Torna alla dashboard</a></main>}
    </Suspense>
    <footer className="projects-footer container">
      <a href="https://links-page-bennibeni.vercel.app/">← ALLLINKS</a>
      <span>Realtime · Meteo e notizie</span>
    </footer>
  </>;
}
