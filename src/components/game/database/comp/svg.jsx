import { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from './LoadingImage';
import { fetchWithRetry } from '../../../ui';

const viewBoxCache = {};
const ANIMATION_FPS = 24;

function getOrCreateOffscreenDiv() {
  let div = document.getElementById('svg-offscreen');
  if (!div) {
    div = document.createElement('div');
    div.id = 'svg-offscreen';
    div.style.position = 'absolute';
    div.style.top = '-9999px';
    div.style.left = '-9999px';
    div.style.width = '0';
    div.style.height = '0';
    div.style.overflow = 'hidden';
    document.body.appendChild(div);
  }
  return div;
}

export function SvgArrayFlipbook({ src, fps = ANIMATION_FPS, isLegend, classNames }) {
  const [frames, setFrames] = useState([]);
  const [normalizedFrames, setNormalizedFrames] = useState([]);
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setLoading(true);
    setFrames([]);
    setNormalizedFrames([]);

    fetchWithRetry(src, { signal: controller.signal, init: { cache: 'no-store' } })
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) throw new Error('No frames in this animation.');
        if (!controller.signal.aborted) setFrames(data.map((d) => (typeof d === 'string' ? d : d.svg)));
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [src]);

 useEffect(() => {
  let cancelled = false;
  setNormalizedFrames([]);
  setLoading(true);
  if (frames.length === 0) {
    setLoading(false);
    return;
  }
  delete viewBoxCache[src];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const offscreenDiv = getOrCreateOffscreenDiv();
  const svgs = [];
  let i = 0;
  const MAX_FRAMES = 120; // Limit for performance
  function processBatch() {
    if (cancelled) return;
    const batchSize = 3;
    for (let j = 0; j < batchSize && i < frames.length && i < MAX_FRAMES; ++j, ++i) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = frames[i];
      const svg = tempDiv.querySelector('svg');
      if (!svg) continue;
      svgs.push(svg);
      offscreenDiv.appendChild(svg);
    }
    if (i < frames.length && i < MAX_FRAMES) {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(processBatch);
      } else {
        setTimeout(processBatch, 0);
      }
    } else {
      svgs.forEach(svg => {
        const bbox = svg.getBBox();
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      });
      svgs.forEach(svg => offscreenDiv.removeChild(svg));
      const finalViewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
      viewBoxCache[src] = finalViewBox;
      if (!cancelled) {
        setNormalizedFrames(
          frames.slice(0, MAX_FRAMES).map(svg =>
            svg.replace(
              /viewBox="[^"]+"[^>]+width="[^"]+" height="[^"]+"/,
              `viewBox="${finalViewBox}" width="${maxX - minX}" height="${Math.min(maxY - minY, 350)}"`
            )
          )
        );
        setLoading(false);
      }
    }
  }
  processBatch();
  return () => { cancelled = true; };
}, [frames, src]);

  useEffect(() => {
    setIndex(0);
  }, [normalizedFrames]);

  useEffect(() => {
    if (!isVisible || normalizedFrames.length === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let lastTime = performance.now();
    const frameMs = 1000 / fps;
    const animate = (now) => {
      if (!isVisible || normalizedFrames.length === 0) return;
      const elapsed = now - lastTime;
      if (elapsed >= frameMs) {
        const framesToAdvance = Math.max(1, Math.floor(elapsed / frameMs));
        setIndex(prev => (prev + framesToAdvance) % normalizedFrames.length);
        lastTime += framesToAdvance * frameMs;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [fps, isVisible, normalizedFrames]);

  useEffect(() => {
    const observer = new window.IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (index >= normalizedFrames.length) setIndex(0);
  }, [normalizedFrames, index]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setIsVisible(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${classNames} flex items-center justify-center h-full w-full rounded-2xl`}
      aria-live="polite"
      role="img"
      aria-label="Animated SVG"
    >
      {error ? (
        <div className="flex min-h-32 items-center justify-center text-sm text-slate-400">
          Couldn't load this animation.
        </div>
      ) : loading || normalizedFrames.length === 0 ? (
        <div className="relative flex min-h-32 w-full items-center justify-center rounded-xl bg-slate-950/80" aria-busy="true">
          <LoadingSpinner />
        </div>
      ) : (
        <div
          dangerouslySetInnerHTML={{ __html: normalizedFrames[index] }}
          aria-label="SVG Frame"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
