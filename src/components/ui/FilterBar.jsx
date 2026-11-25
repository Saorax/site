import { useEffect, useId, useRef } from 'react';
import { cx } from './tones';

const field = 'rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400';

export function FilterBar({ children, summary, onReset, resetLabel = 'Clear filters', className = '' }) {
  return (
    <section className={cx('rounded-2xl border border-slate-700 bg-slate-900 p-2', className)}>
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">{children}</div>
      {(summary || onReset) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span aria-live="polite">{summary}</span>
          {onReset && <button type="button" onClick={onReset} className="rounded-lg bg-slate-800 px-2 py-1 font-bold text-slate-200 hover:bg-slate-700">{resetLabel}</button>}
        </div>
      )}
    </section>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', label, shortcut = true, className = '', autoFocus = false }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!shortcut) return undefined;
    const onKey = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
      event.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);
  return (
    <div className={cx('relative min-w-0 flex-1', className)}>
      <label htmlFor={id} className="sr-only">{label || placeholder}</label>
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.47 9.77l3.63 3.63a.75.75 0 1 0 1.06-1.06l-3.63-3.63A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
      </svg>
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape' && value) { event.preventDefault(); onChange(''); } }}
        placeholder={placeholder}
        className={cx(field, 'w-full pl-9 pr-16 [&::-webkit-search-cancel-button]:hidden')}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button type="button" onClick={() => { onChange(''); ref.current?.focus(); }} className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Clear search">✕</button>
        ) : shortcut ? (
          <kbd className="hidden rounded border border-slate-700 px-1.5 text-[10px] text-slate-500 sm:inline">/</kbd>
        ) : null}
      </div>
    </div>
  );
}

export function SelectInput({ label, value, onChange, options = [], children, inline = true, className = '' }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex min-w-0 text-sm text-slate-300', inline ? 'items-center gap-2' : 'flex-col gap-1', className)}>
      {label && <span className="shrink-0">{label}</span>}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={cx(field, 'min-w-0 max-w-full')}>
        {options.map((option) => {
          const item = typeof option === 'object' ? option : { value: option, label: option };
          return <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>;
        })}
        {children}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange, title, className = '' }) {
  return (
    <label title={title} className={cx('flex cursor-pointer select-none items-center gap-2 text-sm text-slate-300', className)}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-500" />
      {label}
    </label>
  );
}
