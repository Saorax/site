import { useId, useState } from 'react';
import { cx, sectionBorders } from './tones';

export function Heading({ children, tone = 'text-blue-200', className = '', as: Tag = 'h4' }) {
  return <Tag className={cx('mb-2 text-sm font-bold uppercase tracking-wide', tone, className)}>{children}</Tag>;
}

function SectionTitle({ title, count, subtitle, as: Tag }) {
  return (
    <div className="min-w-0">
      <Tag className="text-lg font-bold text-white">
        {title}
        {count !== undefined && count !== null && count !== '' && <span className="ml-2 text-sm font-normal text-slate-400">{count}</span>}
      </Tag>
      {subtitle && <p className="mt-1 max-w-prose text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function Section({
  id,
  title,
  subtitle,
  count,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  tone = 'slate',
  headingAs = 'h3',
  padded = true,
  bodyClassName = '',
  className = '',
}) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const bodyId = useId();
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const border = sectionBorders[tone] || sectionBorders.slate;
  const hasHeader = title || subtitle || actions;
  const body = <div id={bodyId} className={cx(padded && 'space-y-3 p-3', hasHeader && 'border-t border-slate-800', bodyClassName)}>{children}</div>;
  return (
    <section id={id} className={cx('scroll-mt-32 rounded-2xl border bg-slate-900/80 shadow-sm', border, className)}>
      {hasHeader && (
        collapsible ? (
          <div className="flex flex-wrap items-start gap-2 px-3 py-2">
            <button type="button" onClick={toggle} aria-expanded={open} aria-controls={bodyId} className="flex min-w-[12rem] flex-1 items-start justify-between gap-3 text-left">
              <SectionTitle title={title} count={count} subtitle={subtitle} as={headingAs} />
              <span className="shrink-0 rounded-lg bg-black/20 px-2 py-1 text-xs text-slate-300">{open ? 'Hide' : 'Show'}</span>
            </button>
            {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <SectionTitle title={title} count={count} subtitle={subtitle} as={headingAs} />
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )
      )}
      {(!collapsible || open) && body}
    </section>
  );
}

export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return <Tag className={cx('rounded-xl border border-slate-700 bg-slate-950/60 p-2', className)} {...rest}>{children}</Tag>;
}
