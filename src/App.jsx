import { sections } from './sections';
export default function App() {
  return <main className="container">
    <header className="page-heading"><p className="eyebrow">ESPLORA LE FONTI</p><h1>Dashboard Realtime</h1><p className="meta">Scegli una sezione per consultare i dati. Gli aggiornamenti sono attivi solo nella pagina aperta.</p></header>
    <div className="grid section-grid">
      {sections.map((section) => <a className="card section-link" href={section.path} key={section.path}>
        <h2>{section.title}<span aria-hidden="true">→</span></h2>
        <p>{section.description}</p><p className="meta">{section.detail}</p>
      </a>)}
    </div>
  </main>;
}
