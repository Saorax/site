import { useCallback, useEffect, useMemo, useState } from 'react';
import { cx } from './tones';

export const DATA_VIEW_KEY = 'site-data-view';
const EVENT = 'site-data-view-change';
const MODES = ['simple', 'full'];

function storedMode() {
  try {
    const value = window.localStorage.getItem(DATA_VIEW_KEY);
    return MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function urlMode() {
  try {
    const value = new URLSearchParams(window.location.search).get('view');
    return MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function writeUrlMode(mode) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (mode === 'full') params.set('view', 'full');
    else params.delete('view');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  } catch {
  }
}

export function readDataView({ url = false } = {}) {
  if (typeof window === 'undefined') return 'simple';
  return (url && urlMode()) || storedMode() || 'simple';
}

export function setDataView(mode, { url = false } = {}) {
  const next = MODES.includes(mode) ? mode : 'simple';
  try {
    window.localStorage.setItem(DATA_VIEW_KEY, next);
  } catch {
  }
  if (url) writeUrlMode(next);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function useDataView({ url = false } = {}) {
  const [mode, setMode] = useState('simple');
  useEffect(() => {
    const initial = readDataView({ url });
    setMode(initial);
    const onChange = (event) => setMode(MODES.includes(event.detail) ? event.detail : 'simple');
    const onStorage = (event) => {
      if (event.key === DATA_VIEW_KEY) setMode(MODES.includes(event.newValue) ? event.newValue : 'simple');
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [url]);
  const update = useCallback((next) => setDataView(next, { url }), [url]);
  return { mode, full: mode === 'full', setMode: update };
}

export function DataViewToggle({ url = false, size = 'md', className = '' }) {
  const { mode, setMode } = useDataView({ url });
  const item = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  return (
    <div role="group" aria-label="Data view" className={cx('inline-flex shrink-0 rounded-xl border border-slate-700 bg-slate-950 p-0.5', className)}>
      {[['simple', 'Simple'], ['full', 'Full data']].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
          title={value === 'full' ? 'Show internal names, raw fields and JSON' : 'Hide internal fields'}
          className={cx('rounded-lg font-bold transition', item, mode === value ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-800')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function FullOnly({ children, fallback = null, url = false }) {
  const { full } = useDataView({ url });
  return full ? children : fallback;
}

export function ShowFullData({ label = 'Show full data', url = false, className = '' }) {
  const { full, setMode } = useDataView({ url });
  if (full) return null;
  return (
    <button type="button" onClick={() => setMode('full')} className={cx('rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700', className)}>
      {label}
    </button>
  );
}

function safeJson(data) {
  try {
    return JSON.stringify(data, null, 2) ?? '';
  } catch {
    return String(data);
  }
}

function fileName(name) {
  const base = String(name || 'data').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'data';
  return base.endsWith('.json') ? base : `${base}.json`;
}

export function RawData({ data, title = 'Raw Data', source, filename, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState('');
  const text = useMemo(() => (open ? safeJson(data) : ''), [open, data]);
  if (data === undefined || data === null) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text || safeJson(data));
      setCopied('Copied');
    } catch {
      setCopied('Copy failed');
    }
    setTimeout(() => setCopied(''), 1500);
  };
  const download = () => {
    const blob = new Blob([text || safeJson(data)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName(filename || title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  return (
    <section className={cx('rounded-2xl border border-slate-700 bg-slate-900/80', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={cx('inline-block text-xs text-slate-400 transition', open && 'rotate-90')} aria-hidden="true">▶</span>
          <span className="text-sm font-bold text-white">{title}</span>
        </button>
        {open && (
          <div className="flex flex-wrap items-center gap-2">
            {copied && <span className="text-xs text-slate-400" aria-live="polite">{copied}</span>}
            <button type="button" onClick={copy} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Copy JSON</button>
            <button type="button" onClick={download} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Download</button>
            {source && <a href={source} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-blue-200 hover:bg-slate-700">API</a>}
          </div>
        )}
      </div>
      {open && <pre className="max-h-[60vh] overflow-auto border-t border-slate-800 p-3 font-mono text-xs text-slate-200 app-scrollbar">{text}</pre>}
    </section>
  );
}

export function FieldTable({ rows, className = '' }) {
  const visible = (rows || []).filter((row) => row && row[1] !== undefined && row[1] !== null && row[1] !== '');
  if (!visible.length) return null;
  return (
    <dl className={cx('grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,max-content)_1fr]', className)}>
      {visible.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-mono text-xs text-slate-400 sm:pt-0.5">{key}</dt>
          <dd className="min-w-0 break-words text-slate-100">{typeof value === 'object' ? safeJson(value) : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
