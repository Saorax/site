import { useRef } from 'react';
import { cx } from './tones';

const styles = {
  primary: {
    list: 'flex flex-wrap items-center gap-2',
    item: 'rounded-xl border px-3 py-2 text-sm font-bold transition',
    on: 'border-blue-400 bg-blue-500 text-white',
    off: 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500',
    count: 'ml-1.5 font-normal opacity-80',
  },
  small: {
    list: 'flex flex-wrap items-center gap-1.5',
    item: 'rounded-lg px-2.5 py-1 text-xs font-bold transition',
    on: 'bg-blue-500 text-white',
    off: 'bg-slate-800 text-slate-300 hover:bg-slate-700',
    count: 'ml-1 font-normal opacity-80',
  },
  chips: {
    list: 'flex gap-2 overflow-x-auto pb-1 app-scrollbar',
    item: 'shrink-0 rounded-xl border px-3 py-1.5 text-sm transition',
    on: 'border-blue-400 bg-blue-500/20 text-white',
    off: 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500',
    count: 'ml-1.5 text-slate-400',
  },
};

export function Tabs({ items, value, onChange, variant = 'primary', label = 'Views', className = '' }) {
  const style = styles[variant] || styles.primary;
  const refs = useRef([]);
  const enabled = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);
  const onKeyDown = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const edge = { Home: enabled[0], End: enabled[enabled.length - 1] }[event.key];
    if (step === undefined && edge === undefined) return;
    event.preventDefault();
    const position = enabled.indexOf(index);
    const target = edge ?? enabled[(position + step + enabled.length) % enabled.length];
    refs.current[target]?.focus();
    if (!items[target].href) onChange?.(items[target].value);
  };
  return (
    <div role="tablist" aria-label={label} className={cx(style.list, className)}>
      {items.map((item, index) => {
        const active = String(item.value) === String(value);
        const content = (
          <>
            {item.icon}
            {item.label}
            {item.count !== undefined && item.count !== null && <span className={style.count}>{item.count}</span>}
          </>
        );
        const props = {
          ref: (node) => { refs.current[index] = node; },
          role: 'tab',
          'aria-selected': active,
          tabIndex: active ? 0 : -1,
          title: item.title,
          onKeyDown: (event) => onKeyDown(event, index),
          className: cx(style.item, 'inline-flex items-center gap-1.5', active ? style.on : style.off, item.disabled && 'cursor-not-allowed opacity-40'),
        };
        if (item.href) return <a key={item.value} {...props} href={item.href} aria-current={active ? 'page' : undefined}>{content}</a>;
        return <button key={item.value} {...props} type="button" disabled={item.disabled} onClick={() => onChange?.(item.value)}>{content}</button>;
      })}
    </div>
  );
}

export function JumpNav({ items, label = 'Sections', className = '' }) {
  if (!items?.length) return null;
  return (
    <nav aria-label={label} className={cx(styles.chips.list, className)}>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className={cx(styles.chips.item, styles.chips.off)}>
          {item.label}
          {item.count !== undefined && item.count !== null && <span className={styles.chips.count}>{item.count}</span>}
        </a>
      ))}
    </nav>
  );
}
