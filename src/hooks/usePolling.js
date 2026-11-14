import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolling(load, { interval = 5000, paused = false, timeout = 15000, maxRetryInterval = 300000 } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: false, updatedAt: null, cycles: 0 });
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine !== false);
  const failures = useRef(0);
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    globalThis.addEventListener?.('online', connected);
    globalThis.addEventListener?.('offline', disconnected);
    return () => {
      globalThis.removeEventListener?.('online', connected);
      globalThis.removeEventListener?.('offline', disconnected);
    };
  }, []);
  const active = useRef(false);
  const request = useRef(null);
  const timer = useRef(null);
  const run = useRef(null);

  const refresh = useCallback(async () => {
    if (!active.current || !online || request.current) return;
    clearTimeout(timer.current);
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    controller.signal.addEventListener('abort', () => clearTimeout(deadline), { once: true });
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load(controller.signal);
      if (!controller.signal.aborted && active.current && request.current === controller) {
        failures.current = 0;
        setState((s) => ({ ...s, data, error: null, updatedAt: new Date(), cycles: s.cycles + 1 }));
      }
    } catch (error) {
      if (active.current && request.current === controller && (!controller.signal.aborted || timedOut)) {
        failures.current += 1;
        setState((s) => ({ ...s, error: timedOut ? 'Tempo di attesa scaduto' : error.message, cycles: s.cycles + 1 }));
      }
    } finally {
      clearTimeout(deadline);
      if (request.current === controller) {
        request.current = null;
        if (active.current) {
          setState((s) => ({ ...s, loading: false }));
          if (!paused && online) {
            const delay = failures.current ? Math.min(maxRetryInterval, interval * 2 ** Math.min(failures.current, 20)) : interval;
            timer.current = setTimeout(() => run.current(), delay);
          }
        }
      }
    }
  }, [load, interval, paused, timeout, online, maxRetryInterval]);

  useEffect(() => {
    active.current = true;
    run.current = refresh;
    setState((s) => ({ ...s, loading: false }));
    if (!paused && online) refresh();
    return () => {
      active.current = false;
      clearTimeout(timer.current);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh, paused]);

  return { ...state, online, refresh };
}
