import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorState, Img, LoadingState, PageHeader, PageShell, Pill, ScrollX, SearchInput, Section, cx, currencyInfo, formatNumber, useApi, useDebounced, useQueryState } from '../ui';
import { GLORY_BANDS, clanHref, cleanName, dayText, gloryEstimate, gloryRating, gloryWins, rankedFacts, rating, raybotApi, tierFromRating, tierTone, timeAgo } from './raybot';
import { Fact, LegendIcon, PlayerLink, useLegendNames, useNow } from './parts';

const FIELDS = ['w1', 'p1', 'w2', 'p2'];
const EMPTY = { w1: '', p1: '', w2: '', p2: '' };
const WIN_STEPS = [10, 50, 100, 150, 200, 300, 500, 1000];
const LIMITS = { w1: 100000, w2: 100000, p1: 4000, p2: 4000 };

const whole = (text, key) => {
  const value = Number.parseInt(String(text).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(value) ? Math.min(value, LIMITS[key]) : 0;
};

const savedFields = (glory) => (glory ? {
  w1: String(glory.ones.wins || ''),
  p1: String(glory.ones.peakRating || ''),
  w2: String(glory.twos.wins || ''),
  p2: String(glory.twos.peakRating || ''),
} : EMPTY);

function writeFields(fields) {
  const params = new URLSearchParams(window.location.search);
  for (const key of FIELDS) {
    if (fields && fields[key] !== '') params.set(key, fields[key]);
    else params.delete(key);
  }
  const query = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

function readFields() {
  const params = new URLSearchParams(window.location.search);
  const fields = Object.fromEntries(FIELDS.map((key) => [key, params.get(key) ?? '']));
  return FIELDS.some((key) => fields[key] !== '') ? fields : null;
}

const gloryIcon = currencyInfo('glory').src;

function GloryAmount({ value, className = 'text-3xl' }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-bold tabular-nums text-white', className)}>
      <Img src={gloryIcon} alt="Glory" className="h-[1em] w-[1em] object-contain" />
      {formatNumber(value)}
    </span>
  );
}

function NumberField({ label, value, onChange, placeholder, max, note }) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-0.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold tabular-nums text-white outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {note && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{note}</span>}
    </label>
  );
}

function Lookup({ onPick }) {
  const [query, setQuery] = useState('');
  const text = useDebounced(query.replace(/\s+/g, ' ').trim(), 250);
  const isId = /^\d{3,12}$/.test(text);
  const ready = text.length >= 2;
  const legends = useLegendNames();
  const players = useApi(ready ? raybotApi(`/players?search=${encodeURIComponent(text)}&limit=8`) : '', { keepData: false });
  const found = players.data || [];
  const rows = isId && players.data && !found.some((player) => player.bhid === Number(text)) ? [{ bhid: Number(text), name: '', match: 'id' }, ...found] : found;
  const pick = (bhid) => {
    setQuery('');
    onPick(bhid);
  };
  return (
    <div className="min-w-0 space-y-1">
      <SearchInput value={query} onChange={setQuery} placeholder="Player name or Brawlhalla ID" label="Fill in a saved player's stats" />
      {ready && (
        players.loading && !players.data ? <LoadingState inline /> : players.error ? (
          <ErrorState message="Search failed." detail={players.error} onRetry={players.retry} />
        ) : rows.length ? (
          <ul className="grid gap-1 sm:grid-cols-2 2xl:grid-cols-4">
            {rows.map((player) => {
              const name = cleanName(player.name);
              const legend = legends.get(player.bestLegend?.id);
              return (
                <li key={player.bhid}>
                  <button type="button" onClick={() => pick(player.bhid)} className="flex w-full items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-left hover:border-blue-400/60 hover:bg-slate-800/60">
                    <LegendIcon name={legend} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-white">{name || `Brawlhalla ID ${player.bhid}`}</span>
                      {name && <span className="block truncate text-xs text-slate-400">{rankedFacts(player, legend).join(' · ')}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-slate-500">No saved players with that name.</p>
      )}
    </div>
  );
}

function sideNote(ranked, now) {
  if (!ranked) return 'No saved 1v1 stats';
  if (ranked.source === 'queue') return `Top 500, ${timeAgo(ranked.seenAt, now)}`;
  if (ranked.source === 'live') return `Brawlhalla API, ${timeAgo(ranked.seenAt, now)}`;
  return ranked.seenAt ? `Saved ${dayText(`${ranked.seenAt}T12:00:00Z`)}` : '';
}

function teamsNote(data) {
  const teams = data.teams || [];
  if (!teams.length) return 'No saved 2v2 teams';
  const when = data.live ? 'Brawlhalla API' : data.teamsSavedOn ? `saved ${dayText(`${data.teamsSavedOn}T12:00:00Z`)}` : '';
  return [`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`, when].filter(Boolean).join(', ');
}

function PlayerBar({ id, profile, now, onClear }) {
  const data = profile.data;
  const message = profile.error?.message || '';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-sm">
      <div className="min-w-0">
        {data ? (
          <>
            <PlayerLink bhid={data.bhid} className="font-bold text-white">{cleanName(data.name) || `ID ${data.bhid}`}</PlayerLink>
            <span className="ml-2 text-xs tabular-nums text-slate-500">ID {data.bhid}</span>
            {data.clan && <a href={clanHref(data.clan.clanId)} className="ml-2 text-xs font-bold text-blue-300 hover:underline">{cleanName(data.clan.name) || `Clan ${data.clan.clanId}`}</a>}
            {data.live && <span className="ml-2 text-xs text-slate-400">Brawlhalla API, {timeAgo(data.live.fetchedAt, now)}</span>}
          </>
        ) : profile.loading ? <LoadingState inline label="Loading player…" /> : /private/i.test(message) ? (
          <span className="text-slate-300">This profile is private.</span>
        ) : /^No Raybot data/i.test(message) ? (
          <span className="text-slate-300">Raybot hasn't saved Brawlhalla ID {id}.</span>
        ) : profile.error ? (
          <span className="text-slate-300">Couldn't load Brawlhalla ID {id}. <button type="button" onClick={profile.retry} className="font-bold text-blue-300 hover:underline">Retry</button></span>
        ) : null}
      </div>
      <button type="button" onClick={onClear} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Clear player</button>
    </div>
  );
}

function ModeInputs({ title, fields, onChange, winsKey, peakKey, winsLabel, peakLabel, note, children }) {
  const peak = whole(fields[peakKey], peakKey);
  const tier = tierFromRating(peak);
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/40 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {tier && <Pill tone={tierTone(tier)}>{tier}</Pill>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={winsLabel} value={fields[winsKey]} onChange={(value) => onChange(winsKey, value)} placeholder="0" max={LIMITS[winsKey]} />
        <NumberField label={peakLabel} value={fields[peakKey]} onChange={(value) => onChange(peakKey, value)} placeholder="0" max={LIMITS[peakKey]} />
      </div>
      {note && <p className="mt-1 truncate text-[11px] text-slate-400" title={note}>{note}</p>}
      {children}
    </div>
  );
}

function TeamList({ teams }) {
  const [open, setOpen] = useState(false);
  if (!teams?.length) return null;
  const best = Math.max(...teams.map((team) => team.peakRating ?? 0));
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="text-xs font-bold text-blue-300 hover:underline">{open ? 'Hide teams' : 'Show teams'}</button>
      {open && (
        <ul className="mt-1 space-y-0.5 text-xs">
          {teams.map((team) => (
            <li key={team.teamId} className="flex items-baseline justify-between gap-2">
              <PlayerLink bhid={team.teammateId} className="min-w-0 truncate text-slate-200">{team.teammateName ? cleanName(team.teammateName) : team.teammateId ? `ID ${team.teammateId}` : 'Unknown teammate'}</PlayerLink>
              <span className="shrink-0 tabular-nums text-slate-400">
                {formatNumber(team.wins ?? 0)} wins · <span className={cx(team.peakRating === best && best > 0 && 'font-bold text-white')}>peak {rating(team.peakRating)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Result({ glory, blank }) {
  if (blank) {
    return (
      <Section title="Glory" headingAs="h2" bodyClassName="p-2">
        <EmptyState title="Enter wins and peak rating" className="m-1">Or look up a saved player above.</EmptyState>
      </Section>
    );
  }
  const peakSide = glory.peakMode === '1v1' ? glory.ones : glory.twos;
  const otherSide = glory.peakMode === '1v1' ? glory.twos : glory.ones;
  const otherMode = glory.peakMode === '1v1' ? '2v2' : '1v1';
  const nextOnes = gloryWins(glory.ones.wins + 1) - glory.ones.fromWins;
  const nextTwos = gloryWins(glory.twos.wins + 1) - glory.twos.fromWins;
  const nextPeak = gloryRating(peakSide.peakRating + 100) - peakSide.fromPeak;
  const resetTier = tierFromRating(glory.resetRating);
  return (
    <Section title="Glory" headingAs="h2" bodyClassName="space-y-2 p-2">
      <div className="px-1">
        <GloryAmount value={glory.total} className="text-4xl" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fact label="From wins" value={formatNumber(glory.fromWins)} note={`1v1 ${formatNumber(glory.ones.fromWins)} · 2v2 ${formatNumber(glory.twos.fromWins)}`} />
        <Fact label={`From ${glory.peakMode} peak`} value={formatNumber(glory.fromPeak)} note={otherSide.peakRating ? `${otherMode} peak gives ${formatNumber(otherSide.fromPeak)}` : `No ${otherMode} peak`} />
        <Fact label="1v1 after reset" value={glory.ones.peakRating ? rating(glory.resetRating) : '–'} note={glory.ones.peakRating ? resetTier : 'No 1v1 peak'} />
        <Fact label="Next 1v1 win" value={`+${formatNumber(nextOnes)}`} />
        <Fact label="Next 2v2 win" value={`+${formatNumber(nextTwos)}`} />
        <Fact label="+100 peak" value={peakSide.peakRating ? `+${formatNumber(nextPeak)}` : '–'} note={peakSide.peakRating ? `${glory.peakMode} at ${rating(peakSide.peakRating + 100)}` : ''} />
      </div>
      <p className="px-1 text-xs text-slate-400">Wins from 1v1 and 2v2 both count. Only the higher of the two peaks counts.</p>
    </Section>
  );
}

const bandLabel = (band) => (band.from === 0 ? 'Under 1,200' : band.to == null ? `${formatNumber(band.from)}+` : `${formatNumber(band.from)}–${formatNumber(band.to)}`);

function ModeMarks({ modes }) {
  return modes.map((mode) => <Pill key={mode} tone={mode === '1v1' ? 'blue' : 'violet'} className="ml-1.5">{mode}</Pill>);
}

function PeakTable({ ones, twos }) {
  const inBand = (band, value) => value > 0 && value >= band.from && (band.to == null || value <= band.to);
  return (
    <ScrollX>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="px-2 py-1 text-left font-bold">Peak rating</th>
            <th className="px-2 py-1 text-right font-bold">Glory</th>
            <th className="whitespace-nowrap px-2 py-1 text-right font-bold">Per 100 rating</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {GLORY_BANDS.map((band) => {
            const marks = [inBand(band, ones) && '1v1', inBand(band, twos) && '2v2'].filter(Boolean);
            const start = band.from === 0 ? 250 : gloryRating(band.from);
            return (
              <tr key={band.from} className={cx(marks.length > 0 && 'bg-blue-500/10')}>
                <td className="whitespace-nowrap px-2 py-1 tabular-nums text-slate-200">
                  {bandLabel(band)}
                  {band.from > 0 && tierFromRating(band.from) !== tierFromRating(band.from - 1) && <span className="ml-1.5 text-xs text-slate-400">{tierFromRating(band.from)}</span>}
                  <ModeMarks modes={marks} />
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-white">{band.from === 0 ? '250' : `${formatNumber(start)}+`}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{band.slope ? `+${formatNumber(Math.round(band.slope * 1000))}` : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollX>
  );
}

function WinsTable({ ones, twos }) {
  const rows = [...new Set([...WIN_STEPS, ones, twos].filter((value) => value > 0))].sort((a, b) => a - b);
  return (
    <ScrollX>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="px-2 py-1 text-left font-bold">Wins</th>
            <th className="px-2 py-1 text-right font-bold">Glory</th>
            <th className="px-2 py-1 text-right font-bold">Next win</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((wins) => {
            const marks = [wins === ones && '1v1', wins === twos && '2v2'].filter(Boolean);
            return (
              <tr key={wins} className={cx(marks.length > 0 && 'bg-blue-500/10')}>
                <td className="whitespace-nowrap px-2 py-1 tabular-nums text-slate-200">{formatNumber(wins)}<ModeMarks modes={marks} /></td>
                <td className="px-2 py-1 text-right tabular-nums text-white">{formatNumber(gloryWins(wins))}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">+{formatNumber(gloryWins(wins + 1) - gloryWins(wins))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollX>
  );
}

export default function RaybotGlory() {
  const [id, setId] = useQueryState('id', '');
  const bhid = /^\d{1,12}$/.test(id) ? id : '';
  const profile = useApi(bhid ? raybotApi(`/players/${bhid}/profile`) : '', { keepData: false });
  const [fields, setFields] = useState(EMPTY);
  const initialRef = useRef(null);
  const appliedRef = useRef(null);
  const now = useNow(60000);
  const saved = useMemo(() => savedFields(profile.data?.glory), [profile.data]);

  useEffect(() => {
    const initial = readFields();
    initialRef.current = initial;
    if (initial) setFields(initial);
  }, []);

  useEffect(() => {
    const data = profile.data;
    if (!data || appliedRef.current === data.bhid) return;
    appliedRef.current = data.bhid;
    if (initialRef.current) {
      initialRef.current = null;
      return;
    }
    setFields(saved);
    writeFields(null);
  }, [profile.data]);

  const change = (key, value) => {
    const next = { ...fields, [key]: value.replace(/[^\d]/g, '').slice(0, 6) };
    setFields(next);
    writeFields(next);
  };
  const pickPlayer = (next) => {
    initialRef.current = null;
    appliedRef.current = null;
    setId(String(next));
  };
  const clearPlayer = () => {
    appliedRef.current = null;
    setId('');
    setFields(EMPTY);
    writeFields(null);
  };
  const useSaved = () => {
    setFields(saved);
    writeFields(null);
  };

  const values = Object.fromEntries(FIELDS.map((key) => [key, whole(fields[key], key)]));
  const blank = FIELDS.every((key) => !values[key]);
  const glory = gloryEstimate(values.w1, values.p1, values.w2, values.p2);
  const edited = Boolean(profile.data) && FIELDS.some((key) => String(fields[key]) !== saved[key]);
  const data = profile.data;

  useEffect(() => {
    document.title = data?.name ? `${cleanName(data.name)}: Brawlhalla Glory` : 'Brawlhalla Glory Calculator';
  }, [data?.name]);

  return (
    <PageShell>
      <PageHeader title="Glory Calculator">
        <Lookup onPick={pickPlayer} />
        {bhid && <PlayerBar id={bhid} profile={profile} now={now} onClear={clearPlayer} />}
      </PageHeader>

      <div className="grid items-start gap-3 lg:grid-cols-2 min-[112.5rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <Section
          title="Season stats"
          headingAs="h2"
          bodyClassName="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
          actions={(
            <>
              {!blank && <GloryAmount value={glory.total} className="text-sm lg:hidden" />}
              {edited ? (
                <button type="button" onClick={useSaved} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Use saved stats</button>
              ) : !blank && !data ? (
                <button type="button" onClick={() => { setFields(EMPTY); writeFields(null); }} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Clear</button>
              ) : null}
            </>
          )}
        >
          <ModeInputs title="1v1" fields={fields} onChange={change} winsKey="w1" peakKey="p1" winsLabel="Wins" peakLabel="Peak rating" note={data ? sideNote(data.ranked, now) : ''} />
          <ModeInputs title="2v2" fields={fields} onChange={change} winsKey="w2" peakKey="p2" winsLabel="Wins, all teams" peakLabel="Best team peak" note={data ? teamsNote(data) : ''}>
            {data && <TeamList teams={data.teams} />}
          </ModeInputs>
        </Section>

        <Result glory={glory} blank={blank} />

        <Section title="Glory table" headingAs="h2" padded={false} className="lg:col-span-2 min-[112.5rem]:col-span-1" bodyClassName="grid gap-3 p-2 md:grid-cols-2 min-[112.5rem]:grid-cols-1">
          <PeakTable ones={values.p1} twos={values.p2} />
          <WinsTable ones={values.w1} twos={values.w2} />
        </Section>
      </div>
    </PageShell>
  );
}
