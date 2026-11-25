import { useCallback, useEffect, useState } from 'react';

export function useApi(url, { parse = (response) => response.json(), keepData = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState((previous) => ({ data: keepData ? previous.data : null, error: null, loading: true }));
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || `Request failed (${response.status})`);
        }
        return parse(response);
      })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((previous) => ({ ...previous, error, loading: false }));
      });
    return () => controller.abort();
  }, [url, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}

export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useQueryState(key, fallback = '') {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl !== null) setValue(fromUrl);
  }, [key]);
  const update = useCallback((next) => {
    setValue(next);
    const params = new URLSearchParams(window.location.search);
    if (next === fallback || next === '' || next === null || next === undefined) params.delete(key);
    else params.set(key, String(next));
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [key, fallback]);
  return [value, update];
}
