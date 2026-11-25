import { useEffect, useState } from 'react';
import { cx } from './tones';

export function AsideBox({ title, href, linkLabel, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={cx('min-w-0 rounded-xl border border-slate-700 bg-slate-900/80 p-2', className)}>
      {(title || href || actions) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h2 className="text-xs font-bold uppercase tracking-wide text-blue-200">{title}</h2>}
          {actions}
          {href && <a href={href} className="-my-2 inline-flex shrink-0 items-center py-2.5 text-xs font-bold text-blue-300 hover:underline">{linkLabel || 'Open'} →</a>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

const shown = (value) => value !== null && value !== undefined && value !== false && value !== '';

export function FactList({ rows = [], className = '' }) {
  const list = rows.filter((row) => row && shown(row.value));
  if (!list.length) return null;
  return (
    <dl className={cx('space-y-1 text-sm', className)}>
      {list.map((row) => (
        <div key={row.key || row.label} className="flex items-baseline justify-between gap-3" title={row.title}>
          <dt className="shrink-0 text-slate-400">{row.label}</dt>
          <dd className="min-w-0 text-right font-bold text-white">{row.href ? <a href={row.href} className="hover:text-blue-200 hover:underline">{row.value}</a> : row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkList({ items = [], className = '' }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <ul className={cx('space-y-0.5', className)}>
      {list.map((item) => {
        const body = (
          <>
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              {item.detail && <span className="block truncate text-xs font-normal text-slate-500">{item.detail}</span>}
            </span>
            {shown(item.count) && <span className="shrink-0 text-xs font-normal tabular-nums text-slate-400">{item.count}</span>}
          </>
        );
        const style = cx(
          'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold transition',
          item.active ? 'bg-blue-500/15 text-white' : 'text-slate-200 hover:bg-slate-800/70',
        );
        return (
          <li key={item.key || item.href || item.label}>
            {item.href
              ? <a href={item.href} className={style} aria-current={item.active ? 'true' : undefined} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined}>{body}</a>
              : <button type="button" onClick={item.onClick} className={style} aria-current={item.active ? 'true' : undefined}>{body}</button>}
          </li>
        );
      })}
    </ul>
  );
}

export function useActiveSection(ids) {
  const [active, setActive] = useState('');
  const key = ids.join('|');
  useEffect(() => {
    if (typeof window === 'undefined' || !ids.length) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const nodes = ids
        .map((id) => document.getElementById(id))
        .filter((node) => node && node.getClientRects().length > 0);
      if (!nodes.length) return;
      let current = nodes[0];
      for (const node of nodes) {
        const line = (Number.parseFloat(getComputedStyle(node).scrollMarginTop) || 80) + 8;
        if (node.getBoundingClientRect().top <= line) current = node;
      }
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atEnd) {
        const hashed = nodes.find((node) => `#${node.id}` === window.location.hash);
        const rect = hashed?.getBoundingClientRect();
        if (rect && rect.top < window.innerHeight && rect.bottom > 0) current = hashed;
      }
      setActive(current.id);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
    };
  }, [key]);
  return active;
}

export function OnThisPage({ items = [], title = 'On this page', className = '' }) {
  const list = items.filter(Boolean);
  const active = useActiveSection(list.map((item) => item.id));
  if (!list.length) return null;
  return (
    <AsideBox title={title} className={className}>
      <nav aria-label={title}>
        <LinkList items={list.map((item) => ({ key: item.id, href: `#${item.id}`, label: item.label, count: item.count, detail: item.detail, active: active === item.id }))} />
      </nav>
    </AsideBox>
  );
}
