import { useState } from 'react';
import { EmptyState, SearchInput, cx, formatNumber } from '../../../ui';

const field = 'w-full min-w-0 cursor-pointer rounded-xl border bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400';

export function useFiltersOpen() {
  return useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches);
}

export function countFilters(values) {
  return values.filter((value) => (Array.isArray(value) ? value.length > 0 : !!value)).length;
}

export function FilterSelect({ label, value, onChange, children, placeholder = 'Any', className = '' }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-400', className)}>
      <span className="truncate">{label}</span>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className={cx(field, value ? 'border-blue-500/70' : 'border-slate-700')}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </label>
  );
}

export function FilterOption({ value, label, count, disabled = false }) {
  return <option value={value} disabled={disabled}>{label ?? value}{count !== undefined ? ` (${formatNumber(count)})` : ''}</option>;
}

export function SortSelect({ value, onChange, options = [], className = '' }) {
  return (
    <label className={cx('flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-400 sm:w-56 sm:flex-none', className)}>
      <span>Sort</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={cx(field, 'border-slate-700')}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function FilterToggle({ label, count, checked, onChange, title }) {
  return (
    <label
      title={title}
      className={cx(
        'inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition',
        checked ? 'border-blue-500/70 bg-blue-500/15 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
      )}
    >
      <input type="checkbox" checked={!!checked} onChange={() => onChange(!checked)} className="h-4 w-4 cursor-pointer accent-blue-500" />
      <span>{label}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-slate-400">{formatNumber(count)}</span>}
    </label>
  );
}

export function IconChip({ selected, onClick, title, count, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={selected}
      className={cx(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-slate-800 p-1 transition',
        selected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-600 opacity-60 hover:opacity-100',
        className
      )}
    >
      {children}
      {count !== undefined && <span className="absolute -right-1 -top-1 rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-4 text-white">{count}</span>}
    </button>
  );
}

export function ResultCount({ shown, total, noun = 'items' }) {
  const text = total !== undefined && total !== shown
    ? `${formatNumber(shown)} of ${formatNumber(total)} ${noun}`
    : `${formatNumber(shown)} ${noun}`;
  return <span className="text-sm font-bold tabular-nums text-slate-300" aria-live="polite">{text}</span>;
}

export function NoMatches({ noun = 'items', onReset }) {
  return (
    <EmptyState
      title={`No ${noun} match these filters`}
      action={onReset && <button type="button" onClick={onReset} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">Clear filters</button>}
    />
  );
}

export function FilterPanel({ search, onSearch, searchPlaceholder = 'Search', sort, onSort, sortOptions, shown, total, noun, tools, activeCount = 0, onReset, chips, selects, toggles, className = '' }) {
  const [open, setOpen] = useFiltersOpen();
  const hasFilters = !!(chips || selects || toggles);
  return (
    <section className={cx('mb-2 flex flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-2', className)}>
      <div className="flex flex-wrap items-end gap-2">
        <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} className="basis-64" />
        {sortOptions?.length > 0 && <SortSelect value={sort} onChange={onSort} options={sortOptions} />}
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              className={cx(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition',
                open ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
              )}
            >
              Filters
              {activeCount > 0 && <span className="rounded-full bg-blue-500 px-1.5 text-xs leading-5 text-white">{activeCount}</span>}
              <svg className={cx('h-4 w-4 text-slate-400 transition', open && 'rotate-180')} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" /></svg>
            </button>
          )}
          {onReset && activeCount > 0 && (
            <button type="button" onClick={onReset} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300 transition hover:border-rose-400/60 hover:text-white">
              Reset filters
            </button>
          )}
        </div>
      </div>
      {open && chips && <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto app-scrollbar p-1">{chips}</div>}
      {open && selects && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{selects}</div>}
      {open && toggles && <div className="flex flex-wrap items-center gap-2">{toggles}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
        <ResultCount shown={shown} total={total} noun={noun} />
        {tools}
      </div>
    </section>
  );
}
