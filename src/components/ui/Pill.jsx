import { badgeTones, cx, pillTones } from './tones';

export function Pill({ children, tone = 'slate', icon = null, title, className = '', as: Tag = 'span', ...rest }) {
  return (
    <Tag title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-0.5 text-xs font-bold', badgeTones[tone] || badgeTones.slate, className)} {...rest}>
      {icon}
      {children}
    </Tag>
  );
}

export function CountPill({ label, value, tone = 'slate', title, href, onClick, active = false, className = '' }) {
  const body = (
    <>
      <span className="block text-[10px] uppercase tracking-wide opacity-80">{label}</span>
      <span className="block text-lg font-bold leading-tight">{value ?? 0}</span>
    </>
  );
  const classes = cx(
    'rounded-xl border px-3 py-2 text-left',
    pillTones[tone] || pillTones.slate,
    (href || onClick) && 'transition hover:brightness-125',
    active && 'ring-2 ring-blue-400',
    className,
  );
  if (href) return <a href={href} title={title} className={classes}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} title={title} aria-pressed={active} className={classes}>{body}</button>;
  return <div title={title} className={classes}>{body}</div>;
}

export function CountPills({ children, className = '' }) {
  return <div className={cx('flex flex-wrap gap-2', className)}>{children}</div>;
}
