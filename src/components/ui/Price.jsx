import Img from './Img';
import { currencyInfo, formatNumber } from './assets';
import { cx } from './tones';

const sizes = {
  sm: { text: 'text-xs', icon: 'h-3.5 w-3.5' },
  md: { text: 'text-sm', icon: 'h-4 w-4' },
  lg: { text: 'text-base', icon: 'h-5 w-5' },
};

export function Price({ value, currency = 'mc', label, strike = false, tone = 'text-slate-100', size = 'md', showName = false, title, className = '' }) {
  const info = currencyInfo(currency);
  const name = label || info.label;
  const style = sizes[size] || sizes.md;
  const free = Number(value) === 0;
  if (free) return <span className={cx('whitespace-nowrap font-bold text-emerald-200', style.text, className)}>Free</span>;
  return (
    <span className={cx('inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 whitespace-nowrap', style.text, strike ? 'text-slate-500 line-through' : tone, className)} title={title || `${formatNumber(value)} ${name}`}>
      <Img src={info.src} alt="" className={cx(style.icon, 'object-contain')} fallback={showName ? null : <span className="order-last text-[0.85em] opacity-80" aria-hidden="true">{info.short || name}</span>} />
      <span className="font-bold">{formatNumber(value)}</span>
      <span className={showName ? '' : 'sr-only'}>{name}</span>
    </span>
  );
}

export function PriceList({ prices = [], joiner = 'or', size = 'md', showName = false, className = '' }) {
  const shown = prices.filter((price) => price && price.value !== undefined && price.value !== null && price.value !== '');
  if (!shown.length) return null;
  return (
    <span className={cx('inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1', className)}>
      {shown.map((price, index) => (
        <span key={`${price.currency}-${index}`} className="inline-flex max-w-full items-center gap-1.5">
          {index > 0 && <span className="text-xs text-slate-500">{joiner}</span>}
          <Price {...price} size={price.size || size} showName={price.showName ?? showName} />
        </span>
      ))}
    </span>
  );
}
