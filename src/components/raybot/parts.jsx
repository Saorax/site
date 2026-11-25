import { useEffect, useMemo, useRef, useState } from 'react';
import { Img, ImgPlaceholder, cx, portraitUrl, useGameNames } from '../ui';
import { cleanName, rankedLegendHref, rankedPlayerHref } from './raybot';

export function useNow(every = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}

export function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  });
  return [ref, width];
}

export function useLegendNames() {
  const names = useGameNames();
  return useMemo(() => new Map((names.legends || []).map((legend) => [Number(legend.id), legend.name])), [names]);
}

export function PlayerLink({ bhid, children, className = '' }) {
  if (!bhid) return <span className={className}>{children}</span>;
  return <a href={rankedPlayerHref(bhid)} className={cx('hover:text-blue-300 hover:underline', className)}>{children}</a>;
}

export function LegendIcon({ name, className = 'h-7 w-7', link = false }) {
  if (!name) return <span className={cx('shrink-0', className)} aria-hidden="true" />;
  const icon = (
    <Img
      src={portraitUrl({ name })}
      alt={name}
      title={link ? `${name} leaderboard` : name}
      className={cx('shrink-0 rounded-md bg-slate-950 object-contain', className)}
      fallback={<ImgPlaceholder className={cx('shrink-0 rounded-md', className)} label={name.slice(0, 2)} />}
    />
  );
  if (!link) return icon;
  return <a href={rankedLegendHref(name)} className="shrink-0 rounded-md hover:opacity-80" aria-label={`${name} leaderboard`}>{icon}</a>;
}

export function Fact({ label, value, note, title }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5" title={title}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate font-bold tabular-nums text-white">{value}</div>
      {note && <div className="truncate text-[11px] text-slate-400">{note}</div>}
    </div>
  );
}

export function Change({ value }) {
  if (value === null || value === undefined) return <span className="text-slate-600">–</span>;
  if (!value) return <span className="text-slate-400">0</span>;
  return <span className={value > 0 ? 'text-emerald-300' : 'text-rose-300'}>{value > 0 ? `+${value}` : value}</span>;
}

export function TeamOrPlayer({ entry, legends, iconClass = 'h-7 w-7', nameClass = 'font-bold text-white', after }) {
  if (entry.gameMode === '2v2' && entry.members?.length) {
    return (
      <div className="min-w-0 space-y-0.5">
        {entry.members.map((member, index) => (
          <div key={index} className="flex min-w-0 items-center gap-1.5">
            <LegendIcon name={legends.get(member.bestLegend)} className={iconClass} link />
            <PlayerLink bhid={member.bhid} className={cx('min-w-0 truncate', nameClass)}>{cleanName(member.name) || `ID ${member.bhid}`}</PlayerLink>
            {index === 0 && after}
          </div>
        ))}
      </div>
    );
  }
  const solo = entry.gameMode !== '2v2';
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <LegendIcon name={legends.get(entry.bestLegend)} className={iconClass} link />
      <PlayerLink bhid={solo ? entry.playerId : null} className={cx('min-w-0 truncate', nameClass)}>{cleanName(entry.name) || `ID ${entry.playerId}`}</PlayerLink>
      {after}
    </div>
  );
}

export function WinBar({ wins, games, className = '' }) {
  if (!games || wins == null) return null;
  const share = Math.max(0, Math.min(100, (100 * wins) / games));
  return (
    <div className={cx('flex h-1.5 overflow-hidden rounded-full bg-rose-400/70', className)} title={`${share.toFixed(1)}% won`}>
      <div className="h-full bg-emerald-400" style={{ width: `${share}%` }} />
    </div>
  );
}
