import { formatNumber } from './assets';
import { cx } from './tones';

const button = 'rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';

export function Pagination({ page, totalPages, onChange, className = '' }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className={cx('flex flex-wrap items-center justify-center gap-2 py-2 text-sm text-slate-300', className)}>
      <button type="button" className={button} disabled={page <= 1} onClick={() => onChange(1)} aria-label="First page">«</button>
      <button type="button" className={button} disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="tabular-nums">Page {formatNumber(page)} of {formatNumber(totalPages)}</span>
      <button type="button" className={button} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
      <button type="button" className={button} disabled={page >= totalPages} onClick={() => onChange(totalPages)} aria-label="Last page">»</button>
    </nav>
  );
}

export function ShowMore({ shown, total, onMore, step = 50, className = '' }) {
  if (shown >= total) return null;
  return (
    <div className={cx('flex flex-wrap items-center justify-center gap-3 py-2 text-sm text-slate-400', className)}>
      <span className="tabular-nums">Showing {formatNumber(shown)} of {formatNumber(total)}</span>
      <button type="button" onClick={() => onMore(Math.min(total, shown + step))} className={button}>Show {formatNumber(Math.min(step, total - shown))} more</button>
      <button type="button" onClick={() => onMore(total)} className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">Show all</button>
    </div>
  );
}
