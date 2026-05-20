import { useEffect, useState } from 'react';

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

export function ImageWithLoader({ src, alt = '', className = '', imgClassName = 'max-h-full max-w-full object-contain', small = false, onError, ...props }) {
  const sources = sourcesList(src);
  const [sourceIndex, setSourceIndex] = useState(0);
  const activeSrc = sources[sourceIndex];
  const [loaded, setLoaded] = useState(() => !!activeSrc && loadedImageSources.has(activeSrc));

  useEffect(() => {
    const nextSrc = sources[0];
    setSourceIndex(0);
    setLoaded(!!nextSrc && loadedImageSources.has(nextSrc));
  }, [sources.join('|')]);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {activeSrc && !loaded && <LoadingSpinner small={small} />}
      {activeSrc ? (
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

export function RawDataDetails({ data, title = 'Raw Data' }) {
  if (!data) return null;
  return (
    <details className="rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
      <summary className="cursor-pointer select-none text-lg font-bold text-gray-900 dark:text-white">{title}</summary>
      <pre className="mt-3 max-h-[70vh] overflow-auto rounded-lg bg-gray-100 dark:bg-slate-950 p-4 text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
