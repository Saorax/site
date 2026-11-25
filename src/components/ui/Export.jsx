import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadRows } from './download';
import { useQueryState } from './hooks';
import { cx } from './tones';

const button = 'rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

export function ExportButtons({ filename, rows, columns, label = 'Export', className = '' }) {
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState('');
  const empty = Array.isArray(rows) && rows.length === 0;
  const count = Array.isArray(rows) ? rows.length : null;
  const run = async (format) => {
    setBusy(format);
    setFailed(false);
    try {
      const list = typeof rows === 'function' ? await rows((done, total) => setProgress(total ? `${done}/${total}` : '')) : rows;
      const name = typeof filename === 'function' ? filename() : filename;
      const columnList = typeof columns === 'function' ? columns() : columns;
      downloadRows(name || 'saorax-export', Array.isArray(list) ? list : [], columnList, format);
    } catch {
      setFailed(true);
    } finally {
      setBusy('');
      setProgress('');
    }
  };
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      {label && <span className="text-xs text-slate-400">{label}</span>}
      {['csv', 'json'].map((format) => (
        <button
          key={format}
          type="button"
          disabled={empty || Boolean(busy)}
          onClick={() => run(format)}
          title={count !== null ? `${count} rows as ${format.toUpperCase()}` : `Download as ${format.toUpperCase()}`}
          className={button}
        >
          {busy === format ? progress || '…' : format.toUpperCase()}
        </button>
      ))}
      {failed && <span className="text-xs text-rose-300">Download failed</span>}
    </span>
  );
}

export function CopyLinkButton({ label = 'Copy Link', className = '' }) {
  const [state, setState] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState('Copied');
    } catch {
      setState('Copy failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(''), 1500);
  };
  return (
    <button type="button" onClick={copy} className={cx(button, className)} aria-live="polite">
      {state || label}
    </button>
  );
}

export function ListTools({ filename, rows, columns, link = true, className = '', children }) {
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-2', className)}>
      {children}
      {link && <CopyLinkButton />}
      <ExportButtons filename={filename} rows={rows} columns={columns} />
    </span>
  );
}

export function useQueryList(key) {
  const [raw, setRaw] = useQueryState(key, '');
  const list = useMemo(() => String(raw || '').split(',').map((item) => item.trim()).filter(Boolean), [raw]);
  const setList = useCallback((next) => {
    const values = Array.isArray(next) ? next : [];
    setRaw(values.filter(Boolean).join(','));
  }, [setRaw]);
  return [list, setList];
}

export function useQueryFlag(key, fallback = false) {
  const [raw, setRaw] = useQueryState(key, fallback ? '1' : '');
  const value = raw === '1' || raw === 'true' || raw === 'on';
  const setValue = useCallback((next) => setRaw(next ? '1' : (fallback ? '0' : '')), [setRaw, fallback]);
  return [value, setValue];
}
