import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ShowMore } from '../../../ui';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const DENSE_CARD = 150;

export function columnCount(width, maxColumns = 4, mobileColumns = 2, minCard = 250) {
  if (minCard < 250) {
    const min = width < 560 ? Math.round(minCard * 0.7) : minCard;
    return Math.max(Math.max(1, mobileColumns), Math.floor((width + 8) / (min + 8)));
  }
  if (width < 560) return Math.max(1, mobileColumns);
  const available = Math.max(2, Math.floor((width + 12) / (minCard + 12)));
  const cap = maxColumns + (width >= 1900 ? 2 : width >= 1400 ? 1 : 0);
  return Math.max(1, Math.min(cap, available));
}

export function pageSize(columns, rows = 8) {
  return Math.max(24, columns * rows);
}

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setWidth(node.clientWidth || 0);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return width;
}

export function VirtualCardGrid({ items, renderItem, getKey, className = '', maxColumns = 4, mobileColumns = 2, minCard = 250, columnLimit = 0, empty = null }) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const width = useWidth(scrollRef);
  const fitted = columnCount(width || 0, maxColumns, mobileColumns, minCard);
  const columns = columnLimit > 0 ? Math.min(columnLimit, fitted) : fitted;
  const step = pageSize(columns);
  const [shown, setShown] = useState(step);
  const list = items || [];
  const first = list.length ? getKey?.(list[0], 0) ?? 0 : '';
  const last = list.length ? getKey?.(list[list.length - 1], list.length - 1) ?? list.length : '';
  const listKey = `${list.length}:${first}:${last}`;

  const firstList = useRef(true);
  useEffect(() => {
    setShown(step);
    if (firstList.current) {
      firstList.current = false;
      return;
    }
    const node = scrollRef.current;
    if (!node || typeof window === 'undefined') return;
    const top = node.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 80 });
  }, [listKey]);

  useEffect(() => {
    setShown((current) => Math.max(current, step));
  }, [step]);

  const total = list.length;
  const visible = Math.min(shown, total);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visible >= total || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown((current) => Math.min(total, current + step));
      },
      { rootMargin: '0px 0px 1200px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, total, step]);

  const [away, setAway] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let frame = 0;
    const check = () => {
      frame = 0;
      const node = scrollRef.current;
      setAway(Boolean(node) && node.getBoundingClientRect().top < -900);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (empty && total === 0) return empty;

  return (
    <div ref={scrollRef} className={className}>
      <div className="grid items-stretch gap-2 px-1 pb-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {list.slice(0, visible).map((item, index) => (
          <div key={getKey?.(item, index) ?? index} className="flex min-w-0 [&>*]:w-full">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
      {visible < total && (
        <div ref={sentinelRef}>
          <ShowMore shown={visible} total={total} step={step} onMore={setShown} />
        </div>
      )}
      {away && (
        <button type="button" onClick={() => window.scrollTo({ top: 0 })} className="fixed bottom-3 right-3 z-20 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-sm font-bold text-white shadow-lg hover:bg-slate-800">
          Back to top
        </button>
      )}
    </div>
  );
}
