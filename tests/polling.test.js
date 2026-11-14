import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { usePolling } from '../src/hooks/usePolling.js';
import { loadNews, loadWeather, loadAirQuality, loadExchangeRate, loadEarthquakes } from '../src/services/realtime.js';

function mount(load, options = {}) {
  let feed;
  function Probe(props) { feed = usePolling(load, props); return null; }
  let root;
  act(() => { root = create(React.createElement(Probe, options)); });
  return { get feed() { return feed; }, update(props) { act(() => root.update(React.createElement(Probe, props))); }, unmount() { act(() => root.unmount()); } };
}

test('pause aborts the active request, ignores stale responses and permits manual refresh', async () => {
  const pending = [];
  const load = (signal) => new Promise((resolve) => pending.push({ signal, resolve }));
  const view = mount(load);
  try {
    assert.equal(pending.length, 1);
    act(() => { view.feed.refresh(); view.feed.refresh(); });
    assert.equal(pending.length, 1);
    view.update({ paused: true });
    assert.equal(pending[0].signal.aborted, true);
    assert.equal(pending.length, 1);
    await act(async () => pending[0].resolve('stale'));
    assert.equal(view.feed.data, null);
    act(() => { view.feed.refresh(); });
    await act(async () => pending[1].resolve('manual'));
    assert.equal(view.feed.data, 'manual');
    assert.equal(view.feed.loading, false);
    view.update({ paused: false });
    assert.equal(pending.length, 3);
    view.unmount();
    assert.equal(pending[2].signal.aborted, true);
  } finally { view.unmount(); }
});

test('failed refresh preserves data and exposes the error', async () => {
  let fail = false;
  const load = async () => { if (fail) throw new Error('offline'); return 42; };
  const view = mount(load, { paused: true });
  try {
    await act(async () => { await view.feed.refresh(); });
    fail = true;
    await act(async () => { await view.feed.refresh(); });
    assert.equal(view.feed.data, 42);
    assert.equal(view.feed.error, 'offline');
    assert.equal(view.feed.cycles, 2);
  } finally { view.unmount(); }
});

test('timeout aborts the request and releases loading state', async () => {
  const load = (signal) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  const view = mount(load, { timeout: 10 });
  try {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.equal(view.feed.error, 'Tempo di attesa scaduto');
    assert.equal(view.feed.loading, false);
  } finally { view.unmount(); }
});

test('automatic polling waits for completion before scheduling another cycle', async () => {
  const pending = [];
  const load = () => new Promise((resolve) => pending.push(resolve));
  const view = mount(load, { interval: 10 });
  try {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.equal(pending.length, 1);
    await act(async () => pending[0]('first'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.equal(pending.length, 2);
  } finally { view.unmount(); }
});

test('separate feeds succeed independently; story HTTP errors are rejected', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('open-meteo')) return { ok: true, json: async () => ({ current_weather: { temperature: 20 } }) };
    if (url.includes('newstories')) return { ok: true, json: async () => [1] };
    return { ok: false, status: 503 };
  };
  try {
    const results = await Promise.allSettled([loadWeather(), loadNews()]);
    assert.equal(results[0].value.temperature, 20);
    assert.match(results[1].reason.message, /503/);
  } finally { globalThis.fetch = original; }
});

test('partial news preserve successful stories and signal missing items', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('newstories')) return { ok: true, json: async () => [1, 2] };
    if (url.includes('/2.json')) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ id: 1, title: 'Available story' }) };
  };
  try {
    const data = await loadNews();
    assert.equal(data.items.length, 1);
    assert.match(data.warning, /1 notizie/);
  } finally { globalThis.fetch = original; }
});

test('errors back off to a cap and a success resets the normal interval', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let fail = true;
  const load = async () => { calls++; if (fail) throw new Error('offline'); return 'ok'; };
  const view = mount(load, { interval: 10, maxRetryInterval: 30 });
  const tick = async (ms) => act(async () => t.mock.timers.tick(ms));
  try {
    await act(async () => {});
    assert.equal(calls, 1);
    await tick(19); assert.equal(calls, 1);
    await tick(1); assert.equal(calls, 2);
    await tick(29); assert.equal(calls, 2);
    fail = false;
    await tick(1); assert.equal(calls, 3);
    await tick(9); assert.equal(calls, 3);
    await tick(1); assert.equal(calls, 4);
  } finally { view.unmount(); }
});

test('offline aborts requests and reconnect respects manual pause', async () => {
  const target = new EventTarget();
  const oldAdd = globalThis.addEventListener;
  const oldRemove = globalThis.removeEventListener;
  globalThis.addEventListener = target.addEventListener.bind(target);
  globalThis.removeEventListener = target.removeEventListener.bind(target);
  const pending = [];
  const load = (signal) => new Promise((resolve) => pending.push({ signal, resolve }));
  const view = mount(load);
  try {
    act(() => target.dispatchEvent(new Event('offline')));
    assert.equal(view.feed.online, false);
    assert.equal(pending[0].signal.aborted, true);
    act(() => { view.feed.refresh(); });
    assert.equal(pending.length, 1);
    act(() => target.dispatchEvent(new Event('online')));
    assert.equal(pending.length, 2);
    view.update({ paused: true });
    act(() => target.dispatchEvent(new Event('offline')));
    act(() => target.dispatchEvent(new Event('online')));
    assert.equal(pending.length, 2);
  } finally {
    view.unmount();
    globalThis.addEventListener = oldAdd;
    globalThis.removeEventListener = oldRemove;
  }
});


test('new sources validate payloads, preserve zero pollution and sort earthquakes', async () => {
  const original = globalThis.fetch;
  let payload;
  globalThis.fetch = async () => ({ ok: true, json: async () => payload });
  try {
    payload = { current: { time: '2026-11-14T10:00', european_aqi: 0, pm2_5: 0, pm10: 0 } };
    assert.equal((await loadAirQuality()).european_aqi, 0);
    payload.current.pm10 = null;
    await assert.rejects(loadAirQuality());
    payload = [{ base: 'EUR', quote: 'USD', rate: 1.1, date: '2026-11-14' }];
    assert.equal((await loadExchangeRate()).rate, 1.1);
    payload[0].rate = 0;
    await assert.rejects(loadExchangeRate());
    payload = { features: Array.from({ length: 12 }, (_, i) => ({ id: `id${i}`, properties: { mag: 3, time: i, place: 'Somewhere' }, geometry: { coordinates: [12, 42, 10] } })) };
    const quakes = await loadEarthquakes();
    assert.equal(quakes.length, 10);
    assert.equal(quakes[0].id, 'id11');
    assert.equal(quakes[0].depth, 10);
    payload = { features: [] };
    assert.deepEqual(await loadEarthquakes(), []);
    payload = {};
    await assert.rejects(loadEarthquakes());
  } finally { globalThis.fetch = original; }
});
