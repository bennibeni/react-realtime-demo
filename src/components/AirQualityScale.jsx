const bands = [
  { max: 20, label: 'Buona', range: '0–20', color: '#50d4c8' },
  { max: 40, label: 'Discreta', range: '>20–40', color: '#65c86f' },
  { max: 60, label: 'Moderata', range: '>40–60', color: '#f5cf55' },
  { max: 80, label: 'Scarsa', range: '>60–80', color: '#f48167' },
  { max: 100, label: 'Molto scarsa', range: '>80–100', color: '#be87d8' },
  { max: Infinity, label: 'Estremamente scarsa', range: '>100', color: '#cb5382' },
];

export default function AirQualityScale({ value }) {
  if (!Number.isFinite(value) || value < 0) return null;
  const band = bands.find((item) => value <= item.max);
  const position = Math.min(value, 120) / 120 * 100;
  return <div className="aqi-scale">
    <p className="aqi-summary">Qualità dell’aria: <strong style={{ color: band.color }}>{band.label}</strong></p>
    <p className="meta">Più basso è l’indice, migliore è la qualità dell’aria.</p>
    <div className="aqi-chart" role="img" aria-label={`AQI europeo ${value}: qualità ${band.label.toLowerCase()}. Buona fino a 20; discreta fino a 40; moderata fino a 60; scarsa fino a 80; molto scarsa fino a 100; estremamente scarsa oltre 100.`}>
      <div className="aqi-marker" style={{ left: `${position}%` }} aria-hidden="true"><span>{value.toLocaleString('it-IT')}</span></div>
      <div className="aqi-track" aria-hidden="true">{bands.map((item) => <span key={item.label} style={{ background: item.color }} />)}</div>
      <div className="aqi-ticks" aria-hidden="true">{[0, 20, 40, 60, 80, 100, 120].map((tick) => <span key={tick} style={{ left: `${tick / 120 * 100}%` }}>{tick === 120 ? '120+' : tick}</span>)}</div>
    </div>
    <ul className="aqi-legend" aria-label="Fasce di riferimento AQI europeo">
      {bands.map((item) => <li key={item.label} className={item === band ? 'aqi-current' : ''}>
        <span className="aqi-swatch" style={{ background: item.color }} aria-hidden="true" />
        <span><strong>{item.label}</strong><span className="meta">{item.range}{item === band ? ' · Valore attuale' : ''}</span></span>
      </li>)}
    </ul>
    <p className="meta">L’AQI può superare 120: in quel caso l’indicatore resta all’estremità, con il valore reale indicato.</p>
    <p className="attribution">Soglie dell’AQI europeo usate da <a href="https://open-meteo.com/en/docs/air-quality-api#european-air-quality-index" target="_blank" rel="noreferrer">Open-Meteo</a>. L’indice complessivo è il maggiore tra gli indici dei singoli inquinanti.</p>
  </div>;
}
