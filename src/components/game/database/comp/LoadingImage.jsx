import { useEffect, useRef, useState } from 'react';
import { FullOnly, RawData, Spinner, formatPatchDate, isPatchNumber } from '../../../ui';

const loadedImageSources = new Set();

function sourcesList(src) {
  return Array.isArray(src) ? src.filter(Boolean) : [src].filter(Boolean);
}

function isGeneratedImageSource(src) {
  return typeof src === 'string' && /\/game\/anim(?:[a-z-]*\/|\/)/i.test(src);
}

const STILL_DELAY = 450;

let sharedObserver = null;
const inViewCallbacks = new Map();

function watchInView(node, onVisible) {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = inViewCallbacks.get(entry.target);
        if (!callback) continue;
        inViewCallbacks.delete(entry.target);
        sharedObserver.unobserve(entry.target);
        callback();
      }
    }, { root: null, rootMargin: '600px 0px' });
  }
  inViewCallbacks.set(node, onVisible);
  sharedObserver.observe(node);
  return () => {
    if (inViewCallbacks.delete(node)) sharedObserver.unobserve(node);
  };
}

export function stillFrameFor(src) {
  if (typeof src !== 'string') return null;
  const match = src.match(/^(.*\/game\/)anim\/(char|weapon|spawnbot)\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)\/(?:loop|all)$/);
  if (!match) return null;
  const [, base, type, id, anim1, anim2, file] = match;
  if (anim1 === 'Animation_Emote') return null;
  return `${base}anim-svg/${type}/${id}/${anim1}/${anim2}/${file}/0`;
}

export function LoadingSpinner({ small = false }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
      <Spinner className={small ? 'h-5 w-5' : 'h-7 w-7'} />
    </div>
  );
}

export const IMAGE_RETRY_LIMIT = 3;

export function retryDelayFor(attempt, baseDelay = 2000) {
  return baseDelay * 2 ** Math.max(0, attempt);
}

export function ImageWithLoader({ src, still, alt = '', className = '', imgClassName = 'max-h-full max-w-full object-contain', small = false, onLoad, onError, eager = false, retryOnError = false, retryDelay = 2000, retryLimit = IMAGE_RETRY_LIMIT, ...props }) {
  const sources = sourcesList(src);
  const stillSrc = still === false ? null : still || stillFrameFor(sources[0]);
  const shouldRetry = retryOnError || sources.some(isGeneratedImageSource);
  const wrapperRef = useRef(null);
  const retryTimerRef = useRef(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const activeSrc = sources[sourceIndex];
  const requestSrc = retryAttempt > 0 && activeSrc
    ? `${activeSrc}${activeSrc.includes('?') ? '&' : '?'}imageRetry=${retryAttempt}`
    : activeSrc;
  const [loaded, setLoaded] = useState(() => !!activeSrc && loadedImageSources.has(activeSrc));
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(() => eager || (!!activeSrc && loadedImageSources.has(activeSrc)));
  const [showStill, setShowStill] = useState(() => !!stillSrc && loadedImageSources.has(stillSrc));
  const [stillLoaded, setStillLoaded] = useState(() => !!stillSrc && loadedImageSources.has(stillSrc));

  useEffect(() => {
    if (!stillSrc || loaded || failed || !inView || showStill) return undefined;
    const timer = setTimeout(() => setShowStill(true), STILL_DELAY);
    return () => clearTimeout(timer);
  }, [stillSrc, loaded, failed, inView, showStill]);

  useEffect(() => {
    const nextSrc = sources[0];
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setSourceIndex(0);
    setRetryAttempt(0);
    setFailed(false);
    setLoaded(!!nextSrc && loadedImageSources.has(nextSrc));
    const stillCached = !!stillSrc && loadedImageSources.has(stillSrc);
    setShowStill(stillCached);
    setStillLoaded(stillCached);
  }, [sources.join('|')]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (eager) {
      setInView(true);
      return;
    }
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    if (inView) return undefined;
    return watchInView(node, () => setInView(true));
  }, [eager, inView]);

  const stillVisible = !!stillSrc && showStill && !loaded && !failed && inView;

  return (
    <div ref={wrapperRef} className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {stillVisible && (
        <img
          src={stillSrc}
          alt=""
          aria-hidden="true"
          decoding="async"
          className={`absolute inset-0 m-auto ${imgClassName} transition-opacity duration-200 ${stillLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => {
            loadedImageSources.add(stillSrc);
            setStillLoaded(true);
          }}
          onError={() => setShowStill(false)}
        />
      )}
      {activeSrc && inView && !loaded && !failed && !(stillVisible && stillLoaded) && <LoadingSpinner small={small} />}
      {failed && !onError ? (
        <span className="px-1 text-center text-[11px] leading-tight text-slate-500">No preview</span>
      ) : activeSrc && inView ? (
        <img
          key={requestSrc}
          src={requestSrc}
          alt={alt}
          className={`relative ${imgClassName} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
          {...props}
          onLoad={(event) => {
            loadedImageSources.add(activeSrc);
            setLoaded(true);
            onLoad?.(event);
          }}
          onError={(event) => {
            if (sourceIndex < sources.length - 1) {
              setSourceIndex((current) => current + 1);
              setLoaded(false);
              return;
            }
            if (shouldRetry && retryAttempt < retryLimit) {
              if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
              setLoaded(false);
              retryTimerRef.current = setTimeout(() => {
                setRetryAttempt((current) => current + 1);
              }, retryDelayFor(retryAttempt, retryDelay));
              return;
            }
            setLoaded(true);
            onError?.(event);
            if (shouldRetry) setFailed(true);
            else if (!onError) event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
    </div>
  );
}

export function AddedBadge({ item, className = '', style, showDate = true, showPatchLabel = true }) {
  const added = item?.added || item?.resolved?.added;
  if (!added) return null;
  const date = formatPatchDate(added.date);
  const realPatch = isPatchNumber(added.patch);
  if (!realPatch && !date) return null;
  const patch = realPatch ? `${showPatchLabel ? 'Patch ' : ''}${String(added.patch).trim()}` : `Added ${date}`;
  return (
    <span
      className={`inline-flex w-fit flex-col items-center whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-bold leading-tight bg-blue-400/10 text-blue-300 sm:px-2.5 sm:py-1 sm:text-[11px] ${className}`}
      style={style}
    >
      <span>{patch}</span>
      {showDate && realPatch && date && <span className="text-[9px] font-semibold opacity-80 sm:text-[10px]">{date}</span>}
    </span>
  );
}

export function getAddedPatch(item) {
  const patch = String(item?.added?.patch || item?.resolved?.added?.patch || '').trim();
  return isPatchNumber(patch) ? patch : '';
}

function patchParts(patch) {
  const [major = '0', minor = '0'] = String(patch).split('.');
  return [Number(major) || 0, Number(minor) || 0];
}

export function comparePatchesDesc(a, b) {
  const [aMajor, aMinor] = patchParts(a);
  const [bMajor, bMinor] = patchParts(b);
  return bMajor - aMajor || bMinor - aMinor || String(b).localeCompare(String(a));
}

export function getPatchGroups(items) {
  const patches = [...new Set((items || []).map(getAddedPatch).filter(Boolean))].sort(comparePatchesDesc);
  return patches.reduce((groups, patch) => {
    const major = patch.split('.')[0] || 'Unknown';
    const group = groups.find((entry) => entry.major === major);
    if (group) group.patches.push(patch);
    else groups.push({ major, patches: [patch] });
    return groups;
  }, []);
}

export function patchFilterValue(major) {
  return `major:${major}`;
}

export function patchFilterMatches(patch, selected) {
  if (!selected) return true;
  const normalizedPatch = String(patch || '').trim();
  const normalizedSelected = String(selected || '').trim();
  if (!normalizedPatch || !normalizedSelected) return false;
  if (normalizedSelected.startsWith('major:')) {
    const major = normalizedSelected.slice('major:'.length);
    return normalizedPatch === major || normalizedPatch.startsWith(`${major}.`);
  }
  return normalizedPatch === normalizedSelected;
}

export function getPatchFilterCounts(items) {
  const counts = {};
  for (const item of items || []) {
    const patch = getAddedPatch(item);
    if (!patch) continue;
    counts[patch] = (counts[patch] || 0) + 1;
    const major = patch.split('.')[0];
    const majorKey = patchFilterValue(major);
    counts[majorKey] = (counts[majorKey] || 0) + 1;
  }
  return counts;
}

export function PatchOptions({ groups, counts = {} }) {
  return (groups || []).map((group) => (
    <optgroup key={group.major} label={`Patch ${group.major}`}>
      <option value={patchFilterValue(group.major)}>
        All {group.major}.x{counts[patchFilterValue(group.major)] !== undefined ? ` (${counts[patchFilterValue(group.major)]})` : ''}
      </option>
      {group.patches.map((patch) => (
        <option key={patch} value={patch}>
          {patch}{counts[patch] !== undefined ? ` (${counts[patch]})` : ''}
        </option>
      ))}
    </optgroup>
  ));
}

export function RawDataDetails({ data, title = 'Raw Data', filename }) {
  if (!data) return null;
  return (
    <FullOnly>
      <RawData data={data} title={title} filename={filename} className="xl:col-span-2" />
    </FullOnly>
  );
}
