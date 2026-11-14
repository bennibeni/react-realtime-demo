async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
  return response.json();
}

export async function loadAirQuality(signal) {
  const data = await fetchJson('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=41.89&longitude=12.51&current=european_aqi,pm2_5,pm10&timezone=Europe%2FRome', signal);
  const current = data.current;
  if (!current || !['european_aqi', 'pm2_5', 'pm10'].every((key) => Number.isFinite(current[key]) && current[key] >= 0) || !current.time) {
    throw new Error('Dati sulla qualità dell’aria non validi');
  }
  return current;
}

export async function loadExchangeRate(signal) {
  const data = await fetchJson('https://api.frankfurter.dev/v2/rates?base=EUR&quotes=USD', signal);
  const rate = Array.isArray(data) && data.find((item) => item.base === 'EUR' && item.quote === 'USD');
  if (!rate || !Number.isFinite(rate.rate) || rate.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(rate.date)) {
    throw new Error('Cambio EUR/USD non valido');
  }
  return rate;
}

export async function loadEarthquakes(signal) {
  const data = await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', signal);
  if (!Array.isArray(data.features)) throw new Error('Elenco terremoti non valido');
  return data.features.filter((event) => event?.id && Number.isFinite(event.properties?.mag) && Number.isFinite(event.properties?.time))
    .sort((a, b) => b.properties.time - a.properties.time).slice(0, 10)
    .map((event) => ({
      id: event.id, magnitude: event.properties.mag, place: event.properties.place || 'Località non disponibile',
      time: event.properties.time, depth: event.geometry?.coordinates?.[2],
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(event.id)}`,
    }));
}

export async function loadWeather(signal) {
  const data = await fetchJson('https://api.open-meteo.com/v1/forecast?latitude=41.89&longitude=12.51&current_weather=true', signal);
  if (!data.current_weather || !Number.isFinite(data.current_weather.temperature)) {
    throw new Error('Dati meteo non validi');
  }
  return data.current_weather;
}

export async function loadNews(signal) {
  const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/newstories.json', signal);
  if (!Array.isArray(ids)) throw new Error('Elenco notizie non valido');
  const results = await Promise.allSettled(ids.slice(0, 50).map((id) =>
    fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, signal)
  ));
  signal?.throwIfAborted();
  const failed = results.filter((result) => result.status === 'rejected');
  if (results.length && failed.length === results.length) throw failed[0].reason;
  return {
    items: results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
      .filter((story) => story && !story.deleted && !story.dead && story.title),
    warning: failed.length ? `${failed.length} notizie non recuperate. Sono mostrate quelle disponibili.` : null,
  };
}
