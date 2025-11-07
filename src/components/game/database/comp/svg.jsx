import { host } from '../../../../stuff';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';

const viewBoxCache = {};

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

export function SvgArrayFlipbook({ src, fps = 24, isLegend, classNames }) {
  const [frames, setFrames] = useState([]);
  const [normalizedFrames, setNormalizedFrames] = useState([]);
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setLoading(true);
    setFrames([]);
    setNormalizedFrames([]);
    fetch(src)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const arr = data.map(d => (typeof d === 'string' ? d : d.svg));
          if (!cancelled) {
            setFrames(arr);
          }
        } else {
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
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
    const animate = (now) => {
      if (!isVisible || normalizedFrames.length === 0) return;
      if (now - lastTime >= 1000 / 24) {
        setIndex(prev => (prev + 1) % normalizedFrames.length);
        lastTime = now;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [isVisible, normalizedFrames]);

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
        <div className="flex items-center justify-center h-full text-red-600 dark:text-red-400">
          Failed to load SVG
        </div>
      ) : loading || normalizedFrames.length === 0 ? (
        <div className="flex items-center justify-center h-full" aria-busy="true">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500 dark:border-gray-300 mr-2"></div>
          <span className="text-gray-900 dark:text-white">Loading...</span>
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
export function SvgTauntDiv({ data, type, langs }) {
  return (
    <div className="mt-4 flex" key={data}>
      <div
        className="w-full col-span-3 bg-gray-100 dark:bg-slate-800 rounded-lg p-2 flex items-center justify-center"
      >
        <SvgArrayFlipbook
          src={`${host}/game/anim/char/3-0/Animation_Emote/a__EmoteAnimation/${data}/${type}`}
          fps={24}
          isLegend={true}
        />
      </div>
    </div>
  );
}
export function SvgWeaponDiv({ data, langs }) {
  return (
    <div className="mt-4 flex" key={data.WeaponSkinID}>
      <div
        className="h-full rounded-lg items-center flex flex-col w-full bg-gray-100 dark:bg-slate-800"
      >
        <SvgArrayFlipbook
          src={`${host}/game/anim/weapon/${data.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${data.BaseWeapon}Pose/all`}
          fps={24}
          classNames={" h-full w-full"}
          isLegend={false}
        />
      </div>
    </div>
  );
}
export function SvgCharDiv({ data, currentAnimation, langs }) {
  const containerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const resizeObserverRef = useRef(null);

  useLayoutEffect(() => {
    if (!containerRef.current || !leftRef.current || !rightRef.current) return;
    const container = containerRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    let resizeTimeout = null;
    resizeObserverRef.current = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const width = left.getBoundingClientRect().width;
        if (width > 500) {
          container.classList.remove('lg:flex-row');
          container.classList.add('flex-col');
          right.classList.remove('flex-col');
          right.style.paddingLeft = '0px';
          right.style.paddingTop = '0.5rem';
        } else {
          container.classList.remove('flex-col');
          container.classList.add('lg:flex-row');
          right.classList.add('flex-col');
          right.style.paddingLeft = '0.5rem';
          right.style.paddingTop = '0px';
        }
      }, 50);
    });
    resizeObserverRef.current.observe(left);
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [data]);

  return (
    <div className="mt-4 flex" ref={containerRef} key={data?.HeroID + '-' + data?.SkinInt}>
      <div
        ref={leftRef}
        className="w-full col-span-3 bg-gray-100 dark:bg-slate-800 rounded-lg p-2 flex items-center justify-center"
      >
        <SvgArrayFlipbook
          src={`${host}/game/anim/char/${data.heroData?.HeroID || data.HeroID}-${data.SkinInt || 0}/Animation_CharacterSelect/a__CharacterSelectAnimation/${currentAnimation.includes('Loop') ? currentAnimation.replace('Loop', 'Selected') : currentAnimation}${data.heroData?.HeroName || data.HeroName}/${currentAnimation.includes('Loop') ? 'loop' : 'all'}`}
          fps={24}
          isLegend={true}
        />
      </div>
      <div ref={rightRef} className="h-full w-full flex gap-2">
        {data.weapons.map((weapon, index) => {
          if (index >= 2) return null;
          return (
            <div
              key={weapon.WeaponSkinID}
              className="bg-gray-100 dark:bg-slate-800 rounded-lg p-2 items-center text-center justify-center w-full h-full"
            >
              <span className="pb-2 text-gray-900 dark:text-white">{langs.content[weapon.DisplayNameKey]}</span>
              <SvgArrayFlipbook
                src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                fps={24}
                classNames={"h-full w-full"}
                isLegend={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}