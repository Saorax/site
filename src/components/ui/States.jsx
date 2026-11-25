import { useState } from 'react';
import { cx } from './tones';

export function Spinner({ className = 'h-4 w-4' }) {
  return <span className={cx('inline-block animate-spin rounded-full border-2 border-slate-600 border-t-blue-400', className)} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading…', rows = 0, inline = false, bare = false, className = '' }) {
  if (inline) {
    return (
      <span role="status" className={cx('inline-flex items-center gap-2 text-sm text-slate-400', className)}>
        <Spinner />
        {label}
      </span>
    );
  }
  return (
    <div role="status" aria-busy="true" className={cx(bare ? 'p-3' : 'rounded-2xl border border-slate-700 bg-slate-900 p-3', className)}>
      <div className="flex items-center gap-2 text-slate-300">
        <Spinner />
        <span>{label}</span>
      </div>
      {rows > 0 && (
        <div className="mt-3 space-y-2" aria-hidden="true">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="h-4 animate-pulse rounded bg-slate-800" style={{ width: `${92 - ((index * 17) % 40)}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkeletonGrid({ count = 8, className = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4', tileClassName = 'h-32' }) {
  return (
    <div className={cx('grid gap-2', className)} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <div key={index} className={cx('animate-pulse rounded-xl bg-slate-800/80', tileClassName)} />)}
    </div>
  );
}

export function EmptyState({ title = 'Nothing to show', children, action, icon, bare = false, className = '' }) {
  return (
    <div className={cx(bare ? 'p-3 text-center' : 'rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-3 text-center', className)}>
      {icon && <div className="mb-2 flex justify-center text-slate-500">{icon}</div>}
      <div className="font-bold text-slate-200">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-prose text-sm text-slate-400">{children}</div>}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Couldn't load this.", detail, onRetry, retryLabel = 'Retry', className = '' }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };
  const detailText = detail instanceof Error ? detail.message : detail;
  return (
    <div role="alert" className={cx('rounded-xl border border-rose-500/40 bg-rose-500/10 p-2 text-rose-200', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <button type="button" onClick={retry} disabled={retrying} className="inline-flex items-center gap-2 rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm font-bold text-rose-100 hover:bg-rose-500/30 disabled:opacity-60">
            {retrying && <Spinner className="h-3.5 w-3.5" />}
            {retryLabel}
          </button>
        )}
      </div>
      {detailText && (
        <details className="mt-2 text-xs text-rose-200/80">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 font-mono app-scrollbar">{String(detailText)}</pre>
        </details>
      )}
    </div>
  );
}
