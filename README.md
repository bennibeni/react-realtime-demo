# Dashboard Realtime

React + Vite, con sette sezioni indipendenti e una pagina iniziale di navigazione.

## Avvio e verifiche

Richiede Node.js 20.19+ oppure 22.12+.

```bash
npm install
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Pagine

| Percorso | Contenuto | Aggiornamento |
| --- | --- | --- |
| `/` | Indice delle sette sezioni | Nessuna richiesta API |
| `/meteo` | Temperatura e vento a Roma, Open-Meteo | 10 minuti |
| `/notizie` | Ultime 50 notizie Hacker News | 60 secondi |
| `/aria` | AQI europeo, PM2.5 e PM10 a Roma, Open-Meteo/CAMS | 30 minuti |
| `/cambio` | Solo EUR/USD e reciproco, Frankfurter | 6 ore |
| `/terremoti` | Ultimi 10 eventi mondiali del feed USGS M 2.5+, ultime 24 ore | 5 minuti |
| `/spazio` | NASA APOD, contenuto del giorno e archivio per data | Su apertura/scelta data, cache 24 ore |
| `/libri` | Open Library, ricerca e preferiti | Su ricerca esplicita, cache 1 ora |

Ogni pagina è accessibile direttamente e dal menu. In produzione, l'hosting deve instradare le rotte a `index.html`, come i server Vite dev/preview.

## Polling e rete

Solo la fonte della pagina aperta viene interrogata. Cambiare sezione interrompe le richieste e il timer della pagina precedente; la nuova pagina riparte attiva. Pausa/Riprendi e Aggiorna ora operano sulla singola sezione. L'aggiornamento manuale è consentito anche durante la pausa.

`src/hooks/usePolling.js` evita richieste sovrapposte, applica un timeout di 15 secondi e attende l'intervallo indicato dalla conclusione di ciascun ciclo. Offline, sospende il polling e annulla le richieste. Al ritorno della rete riparte subito, salvo pausa manuale. Errori consecutivi raddoppiano l'attesa, fino a 30 minuti per meteo/terremoti, cinque minuti per notizie, due ore per aria e 24 ore per cambi. Un successo ripristina l'intervallo normale.

Gli ultimi dati validi rimangono visibili dopo un errore. I contatori misurano i cicli riusciti o falliti, escludendo quelli annullati dalla pausa. Le notizie recuperate vengono mostrate anche quando alcune richieste falliscono.

I servizi sono in `src/services/realtime.js`. Per l'aria sono mostrate l'ora del dato di Roma e l'attribuzione Open-Meteo/CAMS; si tratta di stime da modello atmosferico. Il cambio è di riferimento e la sua data è distinta dall'orario della richiesta. I terremoti riportano magnitudo, profondità e data/ora di Roma con link USGS.

## Spazio e libri

NASA APOD usa `DEMO_KEY`, consente date dal 16 giugno 1995 a oggi e conserva le risposte per 24 ore. Immagini a piena risoluzione e contenuti video si aprono tramite link; la spiegazione originale è espandibile. Se NASA restituisce un errore o il logo generico al posto della foto, la pagina segnala il problema e offre il collegamento ufficiale. Nessuna chiave privata è inclusa.

Open Library viene interrogata solo all'invio della ricerca, con massimo 12 risultati e richieste distanziate di almeno 1,1 secondi nella singola pagina. Titolo, autore, anno e copertina dipendono dal catalogo. Sono gestiti risultati vuoti, copertine mancanti e limiti di richieste. I preferiti sono salvati in localStorage sul dispositivo, senza account o sincronizzazione; eventuali problemi di salvataggio sono segnalati.

## Test

I test unitari coprono concorrenza, pausa/ripresa, timeout, offline, attesa crescente, conservazione dei dati e validazione delle risposte. I test Chromium su viewport desktop e mobile usano API simulate per verificare tutte le rotte, l'isolamento delle richieste, gli errori, la navigazione, l'archivio NASA e i preferiti. Le schermate vengono salvate in `test-results/`.

La pagina `/aria` include una barra dell'AQI europeo con valore corrente, giudizio testuale e sei fasce di riferimento: 0–20 buona, >20–40 discreta, >40–60 moderata, >60–80 scarsa, >80–100 molto scarsa, >100 estremamente scarsa. La barra rappresenta 0–120 e mantiene i valori superiori all'estremità mostrando comunque il numero reale. Soglie: https://open-meteo.com/en/docs/air-quality-api .

## Notizie finanziarie

`/cambio` mostra anche gli ultime 10 notizie dai feed Yahoo Finance per Nasdaq Composite (^IXIC) e Nasdaq-100 (^NDX), in lingua originale, aggiornati ogni 15 minuti. Il pannello ha aggiornamento manuale indipendente e condivide Pausa/Riprendi con il cambio. Un errore delle notizie non blocca la quotazione e viceversa; se una fonte fallisce rimane disponibile l'altra.

I feed non consentono accesso CORS diretto: `server/financial-news.js` espone esclusivamente i due percorsi predefiniti `/api/financial-news/composite` e `/api/financial-news/nasdaq100`, con cache condivisa di cinque minuti e timeout. Funziona con `npm run dev` e `npm run preview`.

Per usare la build completa:

```bash
npm run build
npm start
```

Il server Node serve `dist`, le sottopagine e i feed su http://127.0.0.1:4173. `PORT` e `HOST` sono configurabili. Su hosting puramente statico occorre predisporre gli stessi endpoint lato server: i soli file `dist` non includono il servizio dei feed. Non sono richieste chiavi API o abbonamenti per i feed pubblici.

Nel pannello Nasdaq hanno priorità i titoli che citano Moderna/MRNA, Nvidia/NVDA o Anthropic, riconosciuti senza distinzione di maiuscole e come parole intere. La priorità viene applicata prima di selezionare le 10 notizie; ciascun gruppo resta ordinato dal più recente. Le notizie prioritarie hanno titolo e bordo rossi e una dicitura testuale. La selezione considera i titoli presenti nei feed, non il testo completo degli articoli.

Quando APOD restituisce il logo generico NASA Science oppure un errore, la pagina Spazio prova anche l'API ufficiale WordPress NASA Science (`wp-json/wp/v2/image-article`), selezionando lo slug APOD corrispondente alla data richiesta. Titolo, immagine, spiegazione e crediti sono estratti dalla risposta senza inserire HTML remoto nella pagina. Questo recupero funziona anche se il vecchio risultato incompleto è già in cache; le risposte NASA Science sono conservate per 24 ore. Il link originale punta all'articolo NASA Science della data selezionata.
