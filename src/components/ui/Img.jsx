import { useEffect, useState } from 'react';
import { cx } from './tones';

export default function Img({ src, alt = '', className = '', fallback = null, loading = 'lazy', ...rest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (!src || failed) return fallback;
  return <img src={src} alt={alt} loading={loading} decoding="async" className={className} onError={() => setFailed(true)} {...rest} />;
}

export function ImgPlaceholder({ className = '', label = '' }) {
  return (
    <span className={cx('flex items-center justify-center bg-slate-800 text-center text-[10px] leading-tight text-slate-500', className)} aria-hidden={label ? undefined : 'true'}>
      {label}
    </span>
  );
}
