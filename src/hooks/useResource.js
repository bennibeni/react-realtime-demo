import { useEffect, useRef, useState } from 'react';

// A single request per resource; abort on navigation or a newer query.
export function useResource(load) {
  const [state, setState] = useState({ data: null, loading: false, error: null });
  const active = useRef(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(new Error('Tempo di attesa scaduto')), 20000);
    setState({ data: null, loading: true, error: null });
    Promise.resolve().then(() => load(controller.signal)).then((data) => {
      if (!controller.signal.aborted && active.current === controller) setState({ data, loading: false, error: null });
    }).catch((error) => {
      if (active.current === controller) setState({ data: null, loading: false, error: error.message || 'Impossibile recuperare i dati' });
    }).finally(() => clearTimeout(timeout));
    return () => { active.current = null; clearTimeout(timeout); controller.abort(); };
  }, [load, revision]);
  return { ...state, retry: () => setRevision((n) => n + 1) };
}
