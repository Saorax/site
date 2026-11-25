import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cx } from './tones';

export function PageHeader({ eyebrow, eyebrowTitle, title, titleAs: Title = 'h1', titleNote, subtitle, subtitleClassName = '', meta, image, actions, children, className = '' }) {
  return (
    <header className={cx('rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-sm', className)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          {image && <div className="shrink-0">{image}</div>}
          <div className="min-w-0">
            {eyebrow && <div className="text-xs font-bold uppercase tracking-wide text-blue-300" title={eyebrowTitle}>{eyebrow}</div>}
            <Title className={cx('text-2xl font-bold text-white [overflow-wrap:anywhere] sm:text-3xl', eyebrow && 'mt-1')}>
              {title}
              {titleNote && <span className="ml-2 align-middle text-sm font-normal text-slate-400">{titleNote}</span>}
            </Title>
            {meta && <div className="mt-1 text-sm text-slate-400">{meta}</div>}
            {subtitle && <p className={cx('mt-2 max-w-prose text-base text-slate-200', subtitleClassName)}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex min-w-0 max-w-full flex-col items-start gap-2 xl:items-end [&>*]:max-w-full">{actions}</div>}
      </div>
      {children && <div className="mt-3 space-y-2">{children}</div>}
    </header>
  );
}

export function SidebarHeader({ title, subtitle, as: Tag = 'h1' }) {
  return (
    <div>
      <Tag className="text-xl font-bold text-white">{title}</Tag>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function SidebarItem({ active = false, muted = false, onClick, href, children, className = '' }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag
      href={href}
      type={href ? undefined : 'button'}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'block w-full rounded-xl border px-2.5 py-2 text-left transition',
        active ? 'border-blue-400 bg-blue-500/15' : 'border-slate-800 bg-slate-900 hover:border-slate-600',
        muted && !active && 'opacity-50',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

const asideStacked = 'grid min-w-0 content-start gap-2 px-2 pb-2 sm:grid-cols-2 sm:px-3 sm:pb-3';

export function PageShell({ title, subtitle, sidebar, sidebarLabel = 'Menu', sidebarTitle, sidebarWide = false, aside, asideLabel = 'More on this page', children, className = '' }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const main = <main className="min-w-0 space-y-3 p-2 sm:p-3">{children}</main>;
  if (!sidebar) {
    if (!aside) {
      return <div className={cx('min-h-screen bg-slate-950 text-slate-100', className)}>{main}</div>;
    }
    return (
      <div className={cx('grid min-h-screen grid-cols-1 content-start bg-slate-950 text-slate-100 xl:grid-cols-[minmax(0,1fr)_20rem] min-[112.5rem]:grid-cols-[minmax(0,1fr)_24rem]', className)}>
        {main}
        <aside aria-label={asideLabel} className={cx(asideStacked, 'app-scrollbar xl:sticky xl:top-16 xl:max-h-[calc(100dvh-4rem)] xl:grid-cols-1 xl:self-start xl:overflow-y-auto xl:border-l xl:border-slate-800 xl:p-2')}>{aside}</aside>
      </div>
    );
  }
  const content = typeof sidebar === 'function' ? sidebar({ close }) : sidebar;
  const panel = <aside className="flex h-full flex-col gap-2 overflow-y-auto bg-slate-950 p-2 app-scrollbar">{content}</aside>;
  return (
    <div className={cx('min-h-screen bg-slate-950 text-slate-100', className)}>
      <div className="sticky top-16 z-30 flex items-center justify-between gap-3 border-b [@media(max-height:500px)]:static border-slate-800 bg-slate-950/95 px-2 py-1.5 backdrop-blur sm:px-3 lg:hidden">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{title}</div>
          {subtitle && <div className="truncate text-xs text-slate-400">{subtitle}</div>}
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">{sidebarLabel}</button>
      </div>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-40 lg:hidden [@media(max-height:500px)]:top-0 [@media(max-height:500px)]:z-[110]" role="dialog" aria-modal="true" aria-label={sidebarTitle || sidebarLabel}>
          <button type="button" className="absolute inset-0 bg-black/60" onClick={close} aria-label={`Close ${String(sidebarLabel).toLowerCase()}`} tabIndex={-1} />
          <div className="relative h-full w-[min(calc(100vw-3.5rem),24rem)] border-r border-slate-800">{panel}</div>
          <button type="button" onClick={close} aria-label={`Close ${String(sidebarLabel).toLowerCase()}`} className="absolute top-2 left-[min(calc(100vw-3.5rem),24rem)] ml-2 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className={cx('grid min-h-screen grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)]', sidebarWide && 'xl:grid-cols-[24rem_minmax(0,1fr)]', aside && 'content-start lg:grid-rows-[auto_1fr] 2xl:grid-rows-1', aside && (sidebarWide ? '2xl:grid-cols-[24rem_minmax(0,1fr)_20rem] min-[137.5rem]:grid-cols-[24rem_minmax(0,1fr)_24rem]' : '2xl:grid-cols-[20rem_minmax(0,1fr)_20rem] min-[137.5rem]:grid-cols-[20rem_minmax(0,1fr)_24rem]'))}>
        <div className={cx('sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-hidden border-r border-slate-800 lg:block', aside && 'lg:row-span-2 2xl:row-span-1')}>{panel}</div>
        {aside ? <div className="min-w-0 lg:col-start-2 lg:row-start-1">{main}</div> : main}
        {aside && (
          <aside aria-label={asideLabel} className={cx(asideStacked, 'app-scrollbar lg:col-start-2 lg:row-start-2 2xl:sticky 2xl:top-16 2xl:col-start-3 2xl:row-start-1 2xl:max-h-[calc(100dvh-4rem)] 2xl:grid-cols-1 2xl:self-start 2xl:overflow-y-auto 2xl:border-l 2xl:border-slate-800 2xl:p-2')}>
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}
