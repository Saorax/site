import Img, { ImgPlaceholder } from './Img';
import { legendHref, mapThumbUrl, portraitUrl } from './assets';
import { cx } from './tones';

const aspects = {
  square: 'aspect-square',
  wide: 'aspect-video',
  tall: 'aspect-[3/4]',
  banner: 'aspect-[3/1]',
};

export function ImageTile({
  src,
  label,
  note,
  href,
  onClick,
  aspect = 'square',
  fit = 'contain',
  badge,
  selected = false,
  title,
  imgClassName = '',
  className = '',
  children,
}) {
  const Tag = href ? 'a' : onClick ? 'button' : 'div';
  const interactive = href || onClick;
  return (
    <Tag
      href={href}
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick}
      title={title || (typeof label === 'string' ? label : undefined)}
      aria-pressed={Tag === 'button' ? selected : undefined}
      className={cx(
        'group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-slate-950/60 text-left',
        selected ? 'border-blue-400 ring-1 ring-blue-400/60' : 'border-slate-800',
        interactive && 'transition hover:border-slate-500 focus-visible:border-blue-400 focus-visible:outline-none',
        className,
      )}
    >
      <div className={cx('relative w-full bg-slate-950', aspects[aspect] || aspect)}>
        <Img src={src} alt="" className={cx('absolute inset-0 h-full w-full p-1.5', fit === 'cover' ? 'object-cover p-0' : 'object-contain', imgClassName)} fallback={<ImgPlaceholder className="absolute inset-0" />} />
        {badge && <div className="absolute right-1.5 top-1.5 flex gap-1">{badge}</div>}
      </div>
      {(label || note || children) && (
        <div className="min-w-0 p-2">
          {label && <div className="line-clamp-2 text-xs font-bold leading-tight text-slate-100">{label}</div>}
          {note && <div className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-slate-400">{note}</div>}
          {children}
        </div>
      )}
    </Tag>
  );
}

export function MapTile({ map, name, thumbnail, note, href, size = 'large', className = '' }) {
  const label = name || map?.displayName || map?.name || '';
  const src = mapThumbUrl(thumbnail || map);
  if (size === 'small') {
    const Tag = href ? 'a' : 'span';
    return (
      <Tag href={href} title={label} className={cx('inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-1 pr-2 text-xs text-slate-100', href && 'hover:border-slate-600', className)}>
        <Img src={src} className="h-8 w-14 shrink-0 rounded object-cover" fallback={<ImgPlaceholder className="h-8 w-14 shrink-0 rounded" />} />
        <span className="truncate">{label}</span>
      </Tag>
    );
  }
  return <ImageTile src={src} label={label} note={note} href={href} aspect="wide" fit="cover" className={className} />;
}

const faceSizes = {
  sm: { box: 'w-12', img: 'h-9 w-9', text: 'text-[10px]' },
  md: { box: 'w-16', img: 'h-12 w-12', text: 'text-[11px]' },
  lg: { box: 'w-24', img: 'h-20 w-20', text: 'text-xs' },
};

const faceTones = {
  added: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/40',
  removed: 'bg-rose-500/15 text-rose-100 ring-1 ring-rose-400/40',
  selected: 'bg-blue-500/20 text-white ring-1 ring-blue-400/60',
};

export function LegendFace({ legend, name, src, href, size = 'md', highlight = '', showName = true, onClick, title, className = '' }) {
  const label = name || legend?.name || legend?.bio?.name?.normal || '';
  const image = src || portraitUrl(legend || { name: label });
  const link = href === false ? '' : href || (onClick ? '' : legendHref(label));
  const style = faceSizes[size] || faceSizes.md;
  const Tag = link ? 'a' : onClick ? 'button' : 'div';
  return (
    <Tag
      href={link || undefined}
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick}
      title={title || label}
      className={cx('flex flex-col items-center gap-1 rounded-lg p-1', style.box, style.text, faceTones[highlight] || 'text-slate-300', (link || onClick) && 'transition hover:bg-slate-800/80', className)}
    >
      <Img src={image} alt={showName ? '' : label} className={cx(style.img, 'rounded-lg bg-slate-950 object-contain')} fallback={<ImgPlaceholder className={cx(style.img, 'rounded-lg')} label={label.slice(0, 2)} />} />
      {showName && <span className="w-full truncate text-center">{label}</span>}
    </Tag>
  );
}

export function TileGrid({ children, size = 'md', className = '' }) {
  const sizes = {
    sm: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 min-[137.5rem]:grid-cols-12',
    md: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 min-[137.5rem]:grid-cols-10',
    lg: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[137.5rem]:grid-cols-6',
  };
  return <div className={cx('grid gap-2', sizes[size] || size, className)}>{children}</div>;
}
