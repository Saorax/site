import { forwardRef, useEffect, useRef, useState } from 'react';

const loadedImageSources = new Set();

function sourcesList(src) {
  return Array.isArray(src) ? src.filter(Boolean) : [src].filter(Boolean);
}

export function LoadingSpinner({ small = false }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
      <div className={`${small ? 'h-6 w-6' : 'h-8 w-8'} rounded-full bg-slate-500/40 animate-pulse`} />
    </div>
  );
}

export function ImageWithLoader({ src, alt = '', className = '', imgClassName = 'max-h-full max-w-full object-contain', small = false, onError, eager = false, ...props }) {
  const sources = sourcesList(src);
  const wrapperRef = useRef(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const activeSrc = sources[sourceIndex];
  const [loaded, setLoaded] = useState(() => !!activeSrc && loadedImageSources.has(activeSrc));
  const [inView, setInView] = useState(eager);

  useEffect(() => {
    const nextSrc = sources[0];
    setSourceIndex(0);
    setLoaded(!!nextSrc && loadedImageSources.has(nextSrc));
  }, [sources.join('|')]);

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
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { root: null, rootMargin: '350px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager]);

  return (
    <div ref={wrapperRef} className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {activeSrc && inView && !loaded && <LoadingSpinner small={small} />}
      {activeSrc && inView ? (
        <img
          key={activeSrc}
          src={activeSrc}
          alt={alt}
          className={`${imgClassName} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => {
            loadedImageSources.add(activeSrc);
            setLoaded(true);
          }}
          onError={(event) => {
            if (sourceIndex < sources.length - 1) {
              setSourceIndex((current) => current + 1);
              setLoaded(false);
              return;
            }
            setLoaded(true);
            onError?.(event);
            if (!onError) event.currentTarget.style.display = 'none';
          }}
          {...props}
        />
      ) : null}
    </div>
  );
}

export function AddedBadge({ item, className = '', style, showDate = true, showPatchLabel = true }) {
  const added = item?.added || item?.resolved?.added;
  if (!added) return null;
  const date = added.date ? new Date(`${added.date}T00:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
  const patch = added.patch ? `${showPatchLabel ? 'Patch ' : ''}${added.patch}` : `${showPatchLabel ? 'Patch ' : ''}unknown`;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-lg bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold leading-tight text-blue-700 dark:bg-blue-400/10 dark:text-blue-300 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] ${className}`}
      style={style}
    >
      <span>{patch}</span>
      {showDate && date && <span className="text-[9px] opacity-80 sm:text-[10px]">{date}</span>}
    </span>
  );
}

export function getAddedPatch(item) {
  return String(item?.added?.patch || item?.resolved?.added?.patch || '').trim();
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

export function PatchFilterSelect({ value, onChange, groups, counts = {}, className = '' }) {
  if (!groups?.length) return null;
  return (
    <select
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      className={className || 'bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-2 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer sm:px-3 sm:text-sm'}
    >
      <option value="">Patch Version</option>
      {groups.map((group) => (
        <optgroup key={group.major} label={`Patch ${group.major}`}>
          <option value={patchFilterValue(group.major)}>
            Patch {group.major}{counts[patchFilterValue(group.major)] !== undefined ? ` (${counts[patchFilterValue(group.major)]})` : ''}
          </option>
          {group.patches.map((patch) => (
            <option key={patch} value={patch}>
              {patch}{counts[patch] !== undefined ? ` (${counts[patch]})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export const AppScroller = forwardRef(function AppScroller({ className = '', ...props }, ref) {
  return <div ref={ref} className={`${className} app-scrollbar`} {...props} />;
});

export function RawDataDetails({ data, title = 'Raw Data' }) {
  if (!data) return null;
  return (
    <details className="xl:col-span-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
      <summary className="cursor-pointer select-none text-lg font-bold text-gray-900 dark:text-white">{title}</summary>
      <pre className="mt-3 max-h-[70vh] overflow-auto app-scrollbar rounded-lg bg-gray-100 dark:bg-slate-950 p-4 text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
