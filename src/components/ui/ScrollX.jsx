import { useEffect, useRef, useState } from 'react';
import { cx } from './tones';

export function ScrollX({ children, className = '', hint = 'More columns →' }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = () => setMore(element.scrollWidth - element.clientWidth - element.scrollLeft > 4);
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => {
      element.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, []);
  return (
    <div className="min-w-0">
      <div className="relative">
        <div ref={ref} className={cx('overflow-x-auto app-scrollbar', className)}>{children}</div>
        {more && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-[inherit] bg-gradient-to-l from-slate-950/90 to-transparent" />}
      </div>
      {more && <div className="mt-1 text-right text-xs font-bold text-slate-400">{hint}</div>}
    </div>
  );
}
