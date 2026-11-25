import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Img, ImgPlaceholder, Pill, Section, Tabs, apiUrl, cx, useApi } from '../ui';

const REFRESH_MS = 2 * 60 * 1000;
const SHOWN = 12;
const number = new Intl.NumberFormat('en-US');
const languageNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'language' }) : null;
const linkButton = 'rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700';

const languageName = (code) => {
  if (!code || code === 'other') return 'Other';
  try {
    return languageNames?.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
};

function uptime(startedAt, now) {
  const time = startedAt ? new Date(startedAt).getTime() : NaN;
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
}

function ago(iso, now) {
  const time = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)} min ago`;
}

function StreamCard({ stream, now }) {
  return (
    <a href={stream.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60 transition hover:border-violet-400/60">
      <div className="relative aspect-video bg-slate-900">
        {stream.thumbnail && <Img src={stream.thumbnail} alt="" className="h-full w-full object-cover" />}
        <span className="absolute left-1.5 top-1.5 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Live</span>
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 text-xs font-bold tabular-nums text-white">{number.format(stream.viewers)} watching</span>
        {stream.startedAt && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-xs tabular-nums text-slate-200">{uptime(stream.startedAt, now)}</span>}
      </div>
      <div className="flex flex-1 gap-2 p-2">
        <Img
          src={stream.avatar}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full bg-slate-900 object-cover"
          fallback={<ImgPlaceholder className="h-9 w-9 shrink-0 rounded-full" label={stream.name.slice(0, 2)} />}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate font-bold text-white group-hover:underline">{stream.name}</span>
            {stream.official && <Pill tone="violet" className="shrink-0">Official</Pill>}
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-slate-400" title={stream.title}>{stream.title || 'No title'}</p>
          <div className="mt-0.5 text-xs text-slate-500">{languageName(stream.language)}</div>
        </div>
      </div>
    </a>
  );
}

export default function LiveStreams({ className = '' }) {
  const streams = useApi(apiUrl('/v2/streams/live'));
  const { retry } = streams;
  const [language, setLanguage] = useState('');
  const [all, setAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15000);
    const refresh = setInterval(() => {
      if (document.visibilityState === 'visible') retry();
    }, REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [retry]);

  const data = streams.data;
  const tabs = useMemo(() => {
    const languages = data?.languages || [];
    const top = languages.slice(0, 5);
    if (language && !top.some((entry) => entry.language === language)) {
      const picked = languages.find((entry) => entry.language === language);
      if (picked) top.push(picked);
    }
    return [{ value: '', label: 'All', count: data?.total }, ...top.map((entry) => ({ value: entry.language, label: languageName(entry.language), count: entry.streams }))];
  }, [data, language]);

  if (data && !data.configured) return null;
  if (!data && streams.error) return null;

  const list = (data?.streams || []).filter((stream) => !language || (stream.language || 'other') === language);
  const shown = all ? list : list.slice(0, SHOWN);

  return (
    <Section
      id="streams"
      title="Live on Twitch"
      count={data ? `${number.format(data.total)} streams · ${number.format(data.viewers)} watching` : undefined}
      headingAs="h2"
      tone="violet"
      className={className}
      actions={(
        <>
          {data?.updatedAt && <span className="text-xs text-slate-500">Updated {ago(data.updatedAt, now)}</span>}
          <a href="https://www.twitch.tv/directory/category/brawlhalla" target="_blank" rel="noopener noreferrer" className={linkButton}>Twitch ↗</a>
        </>
      )}
      bodyClassName="space-y-2!"
    >
      {!data && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[137.5rem]:grid-cols-6">{[0, 1, 2, 3].map((index) => <div key={index} className="aspect-video animate-pulse rounded-xl bg-slate-800/80" />)}</div>}
      {data && data.total > 0 && tabs.length > 2 && <Tabs items={tabs} value={language} onChange={(value) => { setLanguage(value); setAll(false); }} variant="small" label="Stream language" />}
      {data && !list.length && <EmptyState bare title={data.total ? 'No streams in this language right now' : 'Nobody is streaming Brawlhalla right now'} />}
      {shown.length > 0 && (
        <div className={cx('grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[137.5rem]:grid-cols-6', streams.loading && 'opacity-80')}>
          {shown.map((stream) => <StreamCard key={stream.channelId} stream={stream} now={now} />)}
        </div>
      )}
      {list.length > SHOWN && (
        <button type="button" onClick={() => setAll((value) => !value)} className={linkButton}>
          {all ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </Section>
  );
}
