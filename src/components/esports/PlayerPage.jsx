import React, { useEffect, useMemo, useState } from "react";
import { FaTwitch, FaTwitter } from "react-icons/fa";
import { host } from "../../stuff";
import {
  apiUrl, Avatar, avatarUrl, Badge, Card, date, Empty, ErrorNote, FlagIcon, Loading, modeName, money, number,
  ordinal, Pagination, points, regionName, SearchInput, Select, Tabs, useApi, useDebounced, useQueryState,
} from "./ui";
import { mapName, useLegendNames } from "./MatchPages";
import { ContributionList } from "./RankingsPage";

const MODES = [["1", "1v1"], ["2", "2v2"], ["other", "Other"]];
const modeKey = (gameMode) => (Number(gameMode) === 1 ? "1" : Number(gameMode) === 2 ? "2" : "other");
const confirmed = (event) => event.placement_confirmed && !event.disqualified && Number(event.placement) > 0;
const FINISHES = {
  gold: (place) => place === 1, silver: (place) => place === 2, bronze: (place) => place === 3,
  top8: (place) => place <= 8, top16: (place) => place <= 16, top32: (place) => place <= 32,
};
const finishCount = (events, key) => events.filter((event) => confirmed(event) && FINISHES[key](Number(event.placement))).length;
const legendArt = (name) => `${host}/game/legends/art/${encodeURIComponent(name ?? "")}`;
const mapArt = (name) => `${host}/game/maps/thumbnail/${encodeURIComponent(name ?? "")}`;
const hide = (event) => { event.currentTarget.style.visibility = "hidden"; };
const usageKey = (value) => String(value ?? "").normalize("NFD").toLowerCase().replace(/^small\s+/, "").replace(/[^a-z0-9]/g, "").replace(/ofthe/g, "of");

const socialUrl = (network, handle) => {
  if (!handle) return null;
  const raw = String(handle).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const name = raw.replace(/^@/, "");
  return /^\w{1,25}$/.test(name) ? (network === "twitter" ? `https://twitter.com/${name}` : `https://twitch.tv/${name}`) : null;
};

export default function PlayerPage({ playerId }) {
  const history = useApi(apiUrl(`/players/${playerId}/history`));
  const providers = new Set((history.data?.player?.identities ?? []).map((identity) => identity.provider));
  const legacy = useApi(providers.has("startgg") ? apiUrl(`/players/${playerId}/legacy-games`) : null);
  const cmode = useApi(providers.has("challengermode") ? apiUrl(`/players/${playerId}/cmode-games`) : null);
  const [tab, setTab] = useQueryState("tab", "events");
  const [finish, setFinish] = useState({ mode: "all", finish: "all", year: "all" });
  const data = history.data;

  const events = useMemo(() => (data?.events ?? []).filter((event) => event.mirror_role !== "secondary")
    .sort((left, right) => new Date(right.starts_at) - new Date(left.starts_at)), [data]);

  useEffect(() => {
    if (data?.player) document.title = `${data.player.display_name} · Brawlhalla Player History`;
  }, [data]);

  const shell = (children) => <div className="mx-auto w-full max-w-[120rem] px-3 py-4 sm:px-6 lg:px-8">{children}</div>;
  if (history.error) return shell(<ErrorNote message={history.error} />);
  if (!data) return shell(<Loading label="Loading player..." />);
  if (!data.player) return shell(<Empty>This player wasn't found.</Empty>);

  const browse = (filters) => { setFinish({ mode: "all", finish: "all", year: "all", ...filters }); setTab("appearances"); };

  return shell(
    <>
      <a href="/esports/player" className="text-sm font-bold text-blue-600 hover:text-blue-500 dark:text-blue-300">← All players</a>
      <ProfileHeader data={data} events={events} legacy={legacy.data} cmode={cmode.data} onBrowse={browse} />
      <ModeCards data={data} events={events} legacy={legacy.data} cmode={cmode.data} onBrowse={browse} />
      <CareerYears events={events} onBrowse={browse} />
      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "events", label: "Events" },
            { key: "opponents", label: "Opponent History" },
            { key: "legends", label: "Legends & Maps" },
            { key: "rankings", label: "Power Rankings" },
            { key: "appearances", label: "All Appearances", count: events.length },
          ]}
        />
        <div className="mt-4">
          {tab === "events" && <EventExplorer playerId={playerId} events={events} />}
          {tab === "opponents" && <OpponentExplorer playerId={playerId} playerName={data.player.display_name} />}
          {tab === "legends" && <CareerUsage legacy={legacy} cmode={cmode} />}
          {tab === "rankings" && <Rankings playerId={playerId} latest={data.latestRankings ?? []} history={data.rankingHistory ?? []} />}
          {tab === "appearances" && <Appearances key={JSON.stringify(finish)} events={events} initial={finish} />}
        </div>
      </div>
    </>,
  );
}


function ProfileHeader({ data, events, legacy, cmode, onBrowse }) {
  const { player } = data;
  const image = player.image ?? legacy?.image ?? avatarUrl(player.id);
  const banner = player.banner_url ?? legacy?.banner ?? null;
  const prefix = player.prefix ?? null;
  const twitter = socialUrl("twitter", player.twitter);
  const twitch = socialUrl("twitch", player.twitch);
  const names = [...new Set([...(data.pastNames ?? []).map((entry) => entry.name), ...(legacy?.names ?? [])])]
    .filter((name) => name && name !== player.display_name);
  const prefixes = (legacy?.prefixes ?? []).filter((value) => value && value !== prefix);
  const identities = player.identities ?? [];
  const brawlhallaId = identities.map((identity) => identity.providerBrawlhallaId).find((value) => /^\d+$/.test(String(value ?? "")));
  const official = events.filter((event) => event.is_official === true).length;
  const community = events.filter((event) => event.is_official === false).length;
  const summary = data.summary ?? {};
  const gamesPlayed = Number(legacy?.gamesPlayed ?? 0) + Number(cmode?.gamesPlayed ?? 0);
  const gamesWon = Number(legacy?.gamesWon ?? 0) + Number(cmode?.gameWins ?? 0);
  const medal = (key, label, icon, tone) => (
    <button type="button" onClick={() => onBrowse({ finish: key })} className={`py-3 text-center transition hover:bg-white/10 ${tone}`}>
      <div className="text-2xl" aria-hidden="true">{icon}</div>
      <div className="text-2xl font-black">{finishCount(events, key)}</div>
      <div className="text-xs font-bold">{label}</div>
    </button>
  );

  return (
    <header className="relative mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-xl dark:border-slate-800">
      {banner && <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url("${banner}")` }} />}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/80 to-slate-900/40" />
      <div className="relative grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]">
        <div className="flex min-w-0 flex-wrap items-start gap-5">
          <div className="relative shrink-0">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border-2 border-slate-600 bg-slate-700 text-5xl font-black shadow-xl sm:h-40 sm:w-40">
              {player.display_name.slice(0, 1).toUpperCase()}
              {image && <img src={image} alt={player.display_name} onError={hide} className="absolute inset-0 h-28 w-28 rounded-2xl object-cover sm:h-40 sm:w-40" />}
            </div>
            {player.country && <span className="absolute -bottom-2 -left-2 rounded-full bg-slate-950 p-1 shadow-lg"><FlagIcon country={player.country} className="h-8 w-8" /></span>}
          </div>
          <div className="min-w-0 flex-1">
            {prefix && <div className="text-lg font-bold text-slate-400 sm:text-2xl">{prefix}</div>}
            <h1 className="break-words text-3xl font-black sm:text-5xl">{player.display_name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {twitter && (
                <a href={twitter} target="_blank" rel="noopener noreferrer" className="group relative rounded-lg bg-sky-500/15 p-2 text-sky-300 hover:bg-sky-500/25" aria-label="Twitter">
                  <FaTwitter className="h-5 w-5" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs opacity-0 transition group-hover:opacity-100">@{String(player.twitter).replace(/^@/, "")}</span>
                </a>
              )}
              {twitch && (
                <a href={twitch} target="_blank" rel="noopener noreferrer" className="group relative rounded-lg bg-violet-500/15 p-2 text-violet-300 hover:bg-violet-500/25" aria-label="Twitch">
                  <FaTwitch className="h-5 w-5" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs opacity-0 transition group-hover:opacity-100">{player.twitch}</span>
                </a>
              )}
              {identities.map((identity) => (
                <span key={`${identity.provider}:${identity.providerPlayerId}`} className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold ring-1 ring-white/10">
                  {identity.provider === "challengermode" ? "Challengermode" : "start.gg"}
                </span>
              ))}
              {brawlhallaId && (
                <a href={`https://corehalla.com/stats/player/${brawlhallaId}`} target="_blank" rel="noreferrer" className="rounded-full bg-black/30 px-3 py-1 font-mono text-xs text-cyan-300 ring-1 ring-white/10 hover:underline">
                  Brawlhalla ID {brawlhallaId} ↗
                </a>
              )}
            </div>
            {player.bio && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-200">Bio: {player.bio}</p>}
            {names.length > 0 && <p className="mt-2 text-sm text-slate-400">Past names: <span className="text-slate-200">{names.join(", ")}</span></p>}
            {prefixes.length > 0 && <p className="mt-1 text-sm text-slate-400">Past prefixes: <span className="text-slate-200">{prefixes.join(", ")}</span></p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded bg-cyan-400/15 px-2 py-1 text-cyan-200">{official} official</span>
              {community > 0 && <span className="rounded bg-slate-700/80 px-2 py-1">{community} community</span>}
            </div>
          </div>
        </div>

        <aside className="self-start overflow-hidden rounded-xl border border-white/15 bg-slate-950/75 backdrop-blur-sm">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">Career record</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <strong className="text-2xl">{number(events.length)}</strong><span className="text-sm text-slate-400">events</span>
              <strong className="ml-auto text-xl text-emerald-300">{money(data.earnings?.total)}</strong><span className="text-xs text-slate-400">earnings</span>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
            {medal("gold", "Gold", "🥇", "text-amber-300")}
            {medal("silver", "Silver", "🥈", "text-slate-200")}
            {medal("bronze", "Bronze", "🥉", "text-orange-300")}
          </div>
          <div className="grid grid-cols-3 gap-px bg-white/10 text-center text-xs sm:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
            {[["Top 8", finishCount(events, "top8"), "top8"], ["Top 16", finishCount(events, "top16"), "top16"], ["Top 32", finishCount(events, "top32"), "top32"],
              ["Sets", summary.played_sets], ["Wins", summary.wins], ["Losses", summary.losses]].map(([label, value, key]) => (
              <button key={label} type="button" disabled={!key} onClick={() => key && onBrowse({ finish: key })} className="bg-slate-950/90 px-1 py-2 enabled:hover:bg-slate-800">
                <div className="text-slate-400">{label}</div>
                <div className="mt-0.5 font-black">{number(value)}</div>
              </button>
            ))}
          </div>
          {gamesPlayed > 0 && (
            <div className="border-t border-white/10 px-4 py-2 text-xs text-slate-400">
              {number(gamesPlayed)} games played · {number(gamesWon)} games won
            </div>
          )}
        </aside>
      </div>
    </header>
  );
}


function WinBar({ wins, total, label }) {
  const rate = total > 0 ? (wins / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm font-bold">
        <span className="text-sky-500">{number(wins)}W</span>
        <span className="text-slate-500 dark:text-slate-300">{number(total)} {label} · {rate.toFixed(1)}%</span>
        <span className="text-rose-500">{number(total - wins)}L</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-rose-500/70"><div className="h-full bg-sky-500" style={{ width: `${rate}%` }} /></div>
    </div>
  );
}

function bestRanking(latest, mode) {
  return latest.filter((entry) => entry.source_filter === "all" && entry.region !== "ALL" && String(entry.game_mode) === mode)
    .sort((left, right) => left.rank - right.rank)[0] ?? null;
}

function ModeCards({ data, events, legacy, cmode, onBrowse }) {
  const cards = MODES.map(([mode, label]) => {
    const modeEvents = events.filter((event) => modeKey(event.game_mode) === mode);
    const legacyMode = legacy?.byMode?.[mode === "other" ? "unknown" : mode];
    return {
      mode, label, modeEvents,
      sets: data.summary?.byMode?.[mode] ?? { playedSets: 0, wins: 0 },
      games: Number(legacyMode?.gamesPlayed ?? 0) + Number(cmode?.byMode?.[mode]?.gamesPlayed ?? 0),
      gameWins: Number(legacyMode?.gamesWon ?? 0) + Number(cmode?.byMode?.[mode]?.gameWins ?? 0),
      earnings: data.earnings?.byMode?.[mode === "other" ? "other" : label] ?? 0,
      ranking: mode === "other" ? null : bestRanking(data.latestRankings ?? [], mode),
    };
  }).filter((card) => card.mode !== "other" || card.modeEvents.length);

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {cards.map((card) => (
        <section key={card.mode} className={`rounded-2xl border border-l-4 border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${card.mode === "1" ? "border-l-cyan-400" : card.mode === "2" ? "border-l-violet-400" : "border-l-slate-500"}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">{card.mode === "other" ? "Other formats" : `${card.label} PR`}</h2>
            <button type="button" onClick={() => onBrowse({ mode: card.mode })} className="text-sm font-bold text-slate-500 hover:text-blue-500 hover:underline">{card.modeEvents.length} events</button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-b border-slate-200 pb-3 text-sm dark:border-slate-800">
            {card.mode !== "other" ? (
              <>
                <div><div className="text-slate-500">Region</div><div className="text-lg font-black text-slate-950 dark:text-white">{card.ranking ? regionName(card.ranking.region) : "—"}</div></div>
                <div>
                  <div className="text-slate-500">Ranking</div>
                  <div className={`text-3xl font-black ${card.mode === "1" ? "text-cyan-600 dark:text-cyan-300" : "text-violet-600 dark:text-violet-300"}`}>{card.ranking ? `#${card.ranking.rank}` : "—"}</div>
                  {card.ranking?.previous_rank != null && <RankChange rank={card.ranking.rank} previous={card.ranking.previous_rank} />}
                </div>
              </>
            ) : (
              <>
                <div><div className="text-slate-500">Events</div><div className="text-lg font-black text-slate-950 dark:text-white">{card.modeEvents.length}</div></div>
                <div><div className="text-slate-500">Sets</div><div className="text-lg font-black text-slate-950 dark:text-white">{number(card.sets.playedSets)}</div></div>
              </>
            )}
            <div><div className="text-slate-500">Earnings</div><div className="text-lg font-black text-emerald-600 dark:text-emerald-300">{money(card.earnings)}</div></div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-sm sm:grid-cols-6">
            {[["Gold", "gold", "text-amber-500"], ["Silver", "silver", "text-slate-400"], ["Bronze", "bronze", "text-orange-500"], ["Top 8", "top8", ""], ["Top 16", "top16", ""], ["Top 32", "top32", ""]].map(([label, key, tone]) => (
              <button key={key} type="button" onClick={() => onBrowse({ mode: card.mode, finish: key })} className="rounded px-1 py-1 text-left transition hover:bg-slate-100 dark:hover:bg-white/10">
                <div className="text-slate-500">{label}</div>
                <div className={`text-lg font-black ${tone || "text-slate-950 dark:text-white"}`}>{finishCount(card.modeEvents, key)}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <WinBar wins={Number(card.sets.wins)} total={Number(card.sets.playedSets)} label="sets" />
            {card.games > 0 && <div className="text-xs font-semibold text-slate-500">{number(card.games)} games played · {number(card.gameWins)} games won</div>}
          </div>
        </section>
      ))}
    </div>
  );
}

function RankChange({ rank, previous }) {
  const change = Number(previous) - Number(rank);
  if (!change) return <div className="text-xs font-bold text-slate-500">Held from #{previous}</div>;
  return <div className={`text-xs font-bold ${change > 0 ? "text-emerald-500" : "text-rose-500"}`}>{change > 0 ? "▲" : "▼"} {Math.abs(change)} from #{previous}</div>;
}


function CareerYears({ events, onBrowse }) {
  const years = useMemo(() => {
    const rows = new Map();
    for (const event of events) {
      const year = new Date(event.starts_at).getFullYear();
      if (!Number.isFinite(year)) continue;
      const row = rows.get(year) ?? { year, events: 0, official: 0, wins: 0, losses: 0, earnings: 0, modes: { 1: 0, 2: 0, other: 0 }, list: [] };
      row.events++;
      if (event.is_official) row.official++;
      row.wins += Number(event.setStats?.wins ?? 0);
      row.losses += Number(event.setStats?.losses ?? 0);
      row.earnings += Number(event.recorded_prize_usd ?? 0);
      row.modes[modeKey(event.game_mode)]++;
      row.list.push(event);
      rows.set(year, row);
    }
    return [...rows.values()].sort((left, right) => right.year - left.year);
  }, [events]);
  if (years.length < 2) return null;
  const busiest = Math.max(...years.map((row) => row.events));
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-lg font-black text-slate-950 dark:text-white">Career by year</h2>
        <span className="text-xs font-bold text-slate-500">All recorded tournaments</span>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-px bg-slate-200 dark:bg-slate-800">
        {years.map((row) => (
          <article key={row.year} className="bg-white px-4 py-3 dark:bg-slate-900">
            <div className="flex items-baseline justify-between">
              <button type="button" onClick={() => onBrowse({ year: String(row.year) })} className="text-xl font-black text-cyan-600 hover:underline dark:text-cyan-300">{row.year}</button>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{row.events} events</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500" style={{ width: `${(100 * row.events) / busiest}%` }} /></div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
              <span>{row.official} official</span>
              <span><b className="text-sky-500">{row.wins}W</b>–<b className="text-rose-500">{row.losses}L</b></span>
              {row.earnings > 0 && <span className="text-emerald-600 dark:text-emerald-400">{money(row.earnings)}</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-bold text-slate-600 dark:text-slate-300">
              {row.modes[1] > 0 && <button type="button" onClick={() => onBrowse({ year: String(row.year), mode: "1" })} className="hover:underline">1v1 {row.modes[1]}</button>}
              {row.modes[2] > 0 && <button type="button" onClick={() => onBrowse({ year: String(row.year), mode: "2" })} className="hover:underline">2v2 {row.modes[2]}</button>}
              {row.modes.other > 0 && <button type="button" onClick={() => onBrowse({ year: String(row.year), mode: "other" })} className="hover:underline">Other {row.modes.other}</button>}
              <span className="ml-auto">🥇{finishCount(row.list, "gold")} 🥈{finishCount(row.list, "silver")} 🥉{finishCount(row.list, "bronze")}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}


function EventExplorer({ playerId, events }) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [year, setYear] = useState("all");
  const [sorting, setSorting] = useState("newest");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useQueryState("event", "");
  const perPage = 50;
  const years = useMemo(() => [...new Set(events.map((event) => new Date(event.starts_at).getFullYear()).filter(Number.isFinite))], [events]);
  const plain = (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const term = plain(search.trim());
  const filtered = events
    .filter((event) => mode === "all" || modeKey(event.game_mode) === mode)
    .filter((event) => year === "all" || new Date(event.starts_at).getFullYear() === Number(year))
    .filter((event) => !term || plain(`${event.tournament_name} ${event.event_name}`).includes(term))
    .sort((left, right) => {
      if (sorting === "oldest") return new Date(left.starts_at) - new Date(right.starts_at);
      if (sorting === "best") return (Number(left.placement) || 1e9) - (Number(right.placement) || 1e9);
      if (sorting === "worst") return (Number(right.placement) || 0) - (Number(left.placement) || 0);
      return new Date(right.starts_at) - new Date(left.starts_at);
    });
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);
  const selected = events.find((event) => String(event.event_id) === String(selectedId)) ?? filtered[0] ?? null;
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-20">
        <div className="grid gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-lg font-black text-slate-950 dark:text-white">{filtered.length} events</span>
            <span className="text-xs font-bold text-slate-500">Page {page} of {pages}</span>
          </div>
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search by event name" />
          <div className="grid grid-cols-3 gap-2">
            <Select label="Gamemode" value={mode} onChange={reset(setMode)} options={[["all", "All"], ...MODES]} />
            <Select label="Year" value={year} onChange={reset(setYear)} options={[["all", "All"], ...years.map((value) => [String(value), String(value)])]} />
            <Select label="Sorting" value={sorting} onChange={reset(setSorting)} options={[["newest", "Newest"], ["oldest", "Oldest"], ["best", "Best place"], ["worst", "Worst place"]]} />
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {visible.map((event) => {
            const active = selected && String(selected.event_id) === String(event.event_id);
            return (
              <button
                key={`${event.event_id}:${event.entrant_id}`}
                type="button"
                onClick={() => setSelectedId(String(event.event_id))}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 dark:border-slate-800 ${active ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
              >
                <EventImage src={event.tournament_image} name={event.tournament_name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-slate-950 dark:text-white">{event.tournament_name}</div>
                  <div className="truncate text-xs font-semibold text-slate-500">{event.event_name}</div>
                  <div className="text-xs font-semibold text-slate-500">{date(event.starts_at)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-black ${Number(event.placement) <= 3 && confirmed(event) ? "text-amber-500" : "text-slate-950 dark:text-white"}`}>{event.disqualified ? "DQ" : ordinal(event.placement)}</div>
                  <div className="text-[11px] font-semibold text-slate-500">of {number(event.entrant_count)}</div>
                </div>
              </button>
            );
          })}
          {!visible.length && <Empty>No events match.</Empty>}
        </div>
        <Pagination page={page} totalPages={pages} onChange={setPage} />
      </section>
      {selected ? <EventDetail key={selected.event_id} playerId={playerId} event={selected} /> : <Card><Empty>Pick an event.</Empty></Card>}
    </div>
  );
}

function EventImage({ src, name, size = "h-12 w-12" }) {
  return src
    ? <img src={src} alt="" loading="lazy" className={`${size} shrink-0 rounded-xl object-cover`} />
    : <div className={`${size} grid shrink-0 place-items-center rounded-xl bg-slate-200 text-lg font-black text-slate-600 dark:bg-slate-700 dark:text-slate-200`}>{String(name ?? "?")[0]?.toUpperCase()}</div>;
}

function EventDetail({ playerId, event }) {
  const detail = useApi(apiUrl(`/players/${playerId}/events/${event.event_id}`));
  const legendName = useLegendNames();
  const [openSet, setOpenSet] = useState(null);
  const data = detail.data;
  const summary = data?.summary;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-4 bg-slate-100 p-4 dark:bg-slate-800">
        <EventImage src={event.tournament_image} name={event.tournament_name} size="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <a href={`/esports/event/${event.event_id}`} className="text-2xl font-black text-slate-950 hover:text-blue-500 dark:text-white">{event.tournament_name}</a>
          <div className="text-sm font-semibold text-slate-500">{event.event_name} · {date(event.starts_at)} · {modeName(event.game_mode)}{event.region ? ` · ${event.region}` : ""}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-slate-700 dark:text-slate-200">
            <span><b>{event.disqualified ? "DQ" : ordinal(event.placement)}</b> out of {number(event.entrant_count)}</span>
            {event.seed && <span className="font-bold">Seed {ordinal(event.seed)}</span>}
            {Number(event.recorded_prize_usd) > 0 && <span className="font-black text-emerald-600 dark:text-emerald-400">{money(event.recorded_prize_usd)}</span>}
            {event.is_official && <Badge tone="blue">Official</Badge>}
          </div>
        </div>
        {summary && (
          <div className="grid w-full gap-3 sm:w-auto sm:min-w-[22rem] sm:grid-cols-2">
            <WinBar wins={summary.setWins} total={summary.setWins + summary.setLosses} label="sets" />
            <WinBar wins={summary.gameWins} total={summary.gameWins + summary.gameLosses} label="games" />
          </div>
        )}
      </div>
      {detail.error && <div className="p-4"><ErrorNote message={detail.error} /></div>}
      {!data && detail.loading && <Loading label="Loading event..." />}
      {data && (
        <div className="grid gap-4 p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <UsageGrid title="Legends played" rows={summary.legends} kind="legend" legendName={legendName} empty="No legends reported" />
            <UsageGrid title="Stages played" rows={summary.maps} kind="map" empty="No stages reported" />
          </div>
          <div>
            <h3 className="mb-2 text-lg font-black text-slate-950 dark:text-white">Sets</h3>
            {!data.sets.length && <Empty>No sets recorded for this event.</Empty>}
            <div className="grid gap-2">
              {data.sets.map((set) => (
                <SetRow key={set.id} set={set} open={openSet === set.id} onToggle={() => setOpenSet(openSet === set.id ? null : set.id)} legendName={legendName} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function UsageGrid({ title, rows, kind, legendName, empty, onPick, picked, perspective = "mine" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
      <h3 className="mb-2 text-base font-black text-slate-950 dark:text-white">{title}</h3>
      {!rows?.length && <div className="text-sm font-semibold text-slate-500">{empty}</div>}
      <div className="grid max-h-[26rem] grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2 overflow-y-auto pr-1">
        {(rows ?? []).map((row) => {
          const name = kind === "legend" ? legendName?.(row.name) ?? row.name : mapName(row.name);
          const wins = perspective === "mine" ? row.wins : row.known - row.wins;
          const body = kind === "legend" ? (
            <div className="flex items-center gap-3">
              <img src={legendArt(row.name)} alt="" loading="lazy" onError={hide} className="h-12 w-12 shrink-0 rounded-lg bg-slate-200 object-cover dark:bg-slate-800" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-black text-slate-950 dark:text-white">{name}</div>
                <UsageLine games={row.games} wins={wins} known={row.known} />
              </div>
            </div>
          ) : (
            <div className="relative h-20 overflow-hidden rounded-lg bg-slate-700">
              <img src={mapArt(row.name)} alt="" loading="lazy" onError={hide} className="absolute inset-0 h-full w-full object-cover brightness-50" />
              <div className="relative flex h-full flex-col items-center justify-center px-2 text-center text-white">
                <div className="font-black">{name}</div>
                <div className="text-xs font-bold">{row.games} {row.games === 1 ? "game" : "games"}{row.known ? ` · ${wins} ${wins === 1 ? "win" : "wins"}` : ""}</div>
              </div>
            </div>
          );
          const active = picked && picked === row.name;
          return onPick
            ? <button key={row.name} type="button" onClick={() => onPick(row)} className={`rounded-xl p-2 text-left transition ${active ? "bg-blue-100 ring-2 ring-blue-400 dark:bg-blue-500/15" : "bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"}`}>{body}</button>
            : <div key={row.name} className={kind === "legend" ? "rounded-xl bg-white p-2 dark:bg-slate-900" : ""}>{body}</div>;
        })}
      </div>
    </div>
  );
}

function UsageLine({ games, wins, known }) {
  if (!known) return <div className="text-xs font-semibold text-slate-500">{games} {games === 1 ? "game" : "games"}</div>;
  const rate = (100 * wins) / known;
  return (
    <div>
      <div className="flex justify-between text-[11px] font-bold">
        <span className="text-sky-500">{wins}W</span>
        <span className="text-slate-500">{games} games · {rate.toFixed(0)}%</span>
        <span className="text-rose-500">{known - wins}L</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-rose-500/70"><div className="h-full bg-sky-500" style={{ width: `${rate}%` }} /></div>
    </div>
  );
}

function SetRow({ set, open, onToggle, legendName, showEvent }) {
  const opponent = set.opponent ?? {};
  const scored = (set.myScore ?? -1) >= 0 && (set.theirScore ?? -1) >= 0;
  const legendIcon = (legend) => <img key={legend} src={legendArt(legend)} title={legendName(legend)} alt={legendName(legend)} onError={hide} className="h-10 w-10 rounded-lg bg-slate-200 object-cover dark:bg-slate-800" />;
  return (
    <div className={`overflow-hidden rounded-xl border ${set.won ? "border-emerald-300/60 dark:border-emerald-500/30" : "border-rose-300/60 dark:border-rose-500/30"}`}>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <span className={`text-center text-xl font-black tabular-nums ${set.won ? "text-emerald-500" : "text-rose-500"}`}>
          {scored ? `${set.myScore} - ${set.theirScore}` : set.myScore === -1 || set.theirScore === -1 ? "DQ" : set.won ? "W" : "L"}
        </span>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 -space-x-3">
            {(opponent.members?.length ? opponent.members : [{ name: opponent.name }]).map((member, index) => <Avatar key={index} src={member.image} name={member.name} size="md" playerId={member.playerId} />)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-black text-slate-950 dark:text-white">{opponent.name}</div>
            <div className="truncate text-xs font-semibold text-slate-500">
              {showEvent ? `${showEvent} · ` : ""}{set.roundName}
              {opponent.seed ? ` · Seed ${opponent.seed}` : ""}{opponent.placement ? ` · Placed ${ordinal(opponent.placement)}` : ""}
            </div>
          </div>
        </div>
        <span className="text-xs font-bold text-slate-500">{set.games.length ? `${set.games.length} games ${open ? "▴" : "▾"}` : date(set.at)}</span>
      </button>
      {open && (
        <div className="grid gap-1 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
          {opponent.members?.some((member) => member.playerId) && (
            <div className="mb-1 flex flex-wrap gap-3 text-xs font-bold">
              {opponent.members.filter((member) => member.playerId).map((member) => <a key={member.playerId} href={`/esports/player/id/${member.playerId}`} className="text-blue-600 hover:underline dark:text-blue-300">{member.name}'s profile →</a>)}
            </div>
          )}
          {set.games.map((game) => (
            <div key={game.gameNumber} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <div className="flex items-center gap-2">
                {game.mine.map(legendIcon)}
                {game.won !== null && <span className={`font-mono text-2xl font-black ${game.won ? "text-emerald-500" : "text-rose-500"}`}>{game.won ? "W" : "L"}</span>}
              </div>
              <div className="text-center">
                <div className="text-sm font-black text-slate-950 dark:text-white">Game {game.gameNumber}</div>
                {game.map && <div className="text-xs font-semibold text-slate-500">{mapName(game.map)}</div>}
              </div>
              <div className="flex items-center justify-end gap-2">
                {game.won !== null && <span className={`font-mono text-2xl font-black ${!game.won ? "text-emerald-500" : "text-rose-500"}`}>{!game.won ? "W" : "L"}</span>}
                {game.theirs.map(legendIcon)}
              </div>
            </div>
          ))}
          {!set.games.length && <div className="text-sm font-semibold text-slate-500">No game data reported.</div>}
          <a href={`/esports/set/${set.id}`} className="mt-1 text-xs font-black text-blue-600 hover:underline dark:text-blue-300">Open match page →</a>
        </div>
      )}
    </div>
  );
}


function OpponentExplorer({ playerId, playerName }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("sets");
  const [order, setOrder] = useState("desc");
  const [mode, setMode] = useState("");
  const [selected, setSelected] = useState(null);
  const query = useDebounced(search.trim());
  const list = useApi(apiUrl(`/players/${playerId}/opponents`, { page, perPage: 25, search: query || undefined, sort, order, gameMode: mode || undefined }));
  const items = list.data?.items ?? [];
  const current = selected ?? items[0] ?? null;
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-20">
        <div className="grid gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search opponents" />
          <div className="grid grid-cols-3 gap-2">
            <Select label="Sort by" value={sort} onChange={reset(setSort)} options={[["sets", "Sets played"], ["winRate", "Set win rate"], ["events", "Shared events"], ["recent", "Last played"]]} />
            <Select label="Order" value={order} onChange={reset(setOrder)} options={[["desc", "Descending"], ["asc", "Ascending"]]} />
            <Select label="Gamemode" value={mode} onChange={reset(setMode)} options={[["", "All"], ["1", "1v1"], ["2", "2v2"]]} />
          </div>
          <div className="text-xs font-bold text-slate-500">{number(list.data?.total ?? 0)} opponents</div>
        </div>
        <div className={`max-h-[70vh] overflow-y-auto ${list.loading ? "opacity-60" : ""}`}>
          {!list.data && list.loading && <Loading />}
          {list.data && !items.length && <Empty>No opponents found.</Empty>}
          {items.map((opponent) => {
            const wins = Number(opponent.wins);
            const losses = Number(opponent.losses);
            const active = current && current.player_id === opponent.player_id;
            return (
              <button key={opponent.player_id} type="button" onClick={() => setSelected(opponent)} className={`block w-full border-b border-slate-100 p-3 text-left transition last:border-0 dark:border-slate-800 ${active ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}>
                <div className="flex items-center gap-3">
                  <Avatar src={opponent.image_url} name={opponent.display_name} playerId={opponent.player_id} />
                  <div className="min-w-0 flex-1">
                    {opponent.prefix && <div className="truncate text-xs font-bold text-slate-500">{opponent.prefix}</div>}
                    <div className="flex items-center gap-1.5 truncate font-black text-slate-950 dark:text-white"><FlagIcon country={opponent.country} className="h-4 w-4" />{opponent.display_name}</div>
                    <div className="text-xs font-semibold text-slate-500">{opponent.events} events · last {date(opponent.last_played_at)}</div>
                  </div>
                </div>
                <div className="mt-2"><WinBar wins={wins} total={wins + losses} label="sets" /></div>
              </button>
            );
          })}
        </div>
        <Pagination page={page} totalPages={list.data?.totalPages} onChange={setPage} />
      </section>
      {current ? <OpponentDetail key={current.player_id} playerId={playerId} playerName={playerName} opponent={current} /> : <Card><Empty>Pick an opponent.</Empty></Card>}
    </div>
  );
}

function OpponentDetail({ playerId, playerName, opponent }) {
  const detail = useApi(apiUrl(`/players/${playerId}/opponents/${opponent.player_id}`));
  const legendName = useLegendNames();
  const [view, setView] = useState("legends");
  const [legend, setLegend] = useState(null);
  const [openSet, setOpenSet] = useState(null);
  const data = detail.data;
  const summary = data?.summary;
  const matchup = legend ? data?.matchups.find((row) => row.name === legend) : null;
  const eventNames = new Map((data?.events ?? []).map((event) => [event.eventId, event.tournamentName]));

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="relative">
        {opponent.banner_url && <img src={opponent.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="relative flex flex-wrap items-center gap-4 bg-slate-100/90 p-4 dark:bg-slate-800/90">
          <Avatar src={opponent.image_url} name={opponent.display_name} size="lg" playerId={opponent.player_id} />
          <div className="min-w-0 flex-1">
            {opponent.prefix && <div className="text-sm font-bold text-slate-500">{opponent.prefix}</div>}
            <a href={`/esports/player/id/${opponent.player_id}`} className="text-3xl font-black text-slate-950 hover:text-blue-500 dark:text-white">{opponent.display_name}</a>
            <div className="text-xs font-bold text-slate-500">
              {playerName} vs {opponent.display_name} · <a href={`/esports/head-to-head?a=${playerId}&b=${opponent.player_id}`} className="text-blue-600 hover:underline dark:text-blue-300">Full head-to-head →</a>
            </div>
          </div>
          {summary && (
            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[24rem] sm:grid-cols-2">
              <WinBar wins={summary.setWins} total={summary.setWins + summary.setLosses} label="sets" />
              <WinBar wins={summary.gameWins} total={summary.gameWins + summary.gameLosses} label="games" />
            </div>
          )}
        </div>
      </div>
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <Tabs value={view} onChange={setView} tabs={[
          { key: "legends", label: "Legend Data" }, { key: "maps", label: "Stage Data" },
          { key: "events", label: "Events", count: data?.events.length }, { key: "sets", label: "Sets", count: data?.sets.length },
        ]} />
      </div>
      {detail.error && <div className="p-4"><ErrorNote message={detail.error} /></div>}
      {!data && detail.loading && <Loading label="Loading matchup..." />}
      {data && (
        <div className="p-4">
          {view === "legends" && (
            <div className="grid gap-4 2xl:grid-cols-2">
              <UsageGrid title={`${playerName}'s legends · pick one for matchup detail`} rows={summary.legends} kind="legend" legendName={legendName} empty="No legends reported" onPick={(row) => setLegend(row.name)} picked={legend} />
              <UsageGrid title={`${opponent.display_name}'s legends`} rows={summary.opponentLegends} kind="legend" legendName={legendName} empty="No legends reported" perspective="theirs" />
              {matchup && (
                <div className="grid gap-4 rounded-xl border border-blue-300/60 p-3 dark:border-blue-500/30 lg:grid-cols-2 2xl:col-span-2">
                  <div className="flex items-center gap-3 lg:col-span-2">
                    <img src={legendArt(matchup.name)} alt="" onError={hide} className="h-16 w-16 rounded-xl bg-slate-200 object-cover dark:bg-slate-800" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xl font-black text-slate-950 dark:text-white">{legendName(matchup.name)}</div>
                      <UsageLine games={matchup.games} wins={matchup.wins} known={matchup.known} />
                    </div>
                  </div>
                  <UsageGrid title={`${opponent.display_name}'s legends against it`} rows={matchup.against} kind="legend" legendName={legendName} empty="No legends reported" perspective="theirs" />
                  <UsageGrid title="Stages played" rows={matchup.maps} kind="map" empty="No stages reported" />
                </div>
              )}
            </div>
          )}
          {view === "maps" && <UsageGrid title="Stages played" rows={summary.maps} kind="map" empty="No stages reported" />}
          {view === "events" && (
            <div className="grid gap-2 lg:grid-cols-2">
              {data.events.map((event) => (
                <a key={event.eventId} href={`/esports/event/${event.eventId}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 hover:border-blue-400 dark:border-slate-800">
                  <EventImage src={event.image} name={event.tournamentName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black text-slate-950 dark:text-white">{event.tournamentName}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{event.eventName} · {modeName(event.gameMode)} · {date(event.lastAt)}</div>
                  </div>
                  <span className="font-black tabular-nums"><span className="text-emerald-500">{event.wins}</span>–<span className="text-rose-500">{event.losses}</span></span>
                </a>
              ))}
            </div>
          )}
          {view === "sets" && (
            <div className="grid gap-2">
              {data.sets.map((set) => (
                <SetRow key={set.id} set={set} open={openSet === set.id} onToggle={() => setOpenSet(openSet === set.id ? null : set.id)} legendName={legendName} showEvent={eventNames.get(set.eventId)} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}


function mergeUsage(rows) {
  const merged = new Map();
  for (const row of rows) {
    if (!row?.name) continue;
    const key = usageKey(row.name);
    const entry = merged.get(key) ?? { name: row.name, games: 0, wins: 0, known: 0 };
    if (row.name.includes(" ") && !entry.name.includes(" ")) entry.name = row.name;
    entry.games += Number(row.games ?? 0);
    if (row.wins != null) { entry.wins += Number(row.wins); entry.known += Number(row.known ?? row.games ?? 0); }
    merged.set(key, entry);
  }
  return [...merged.values()].sort((left, right) => right.games - left.games);
}

function CareerUsage({ legacy, cmode }) {
  const legendName = useLegendNames();
  if ((legacy.loading || cmode.loading) && !legacy.data && !cmode.data) return <Loading label="Loading game history..." />;
  const legends = mergeUsage([...(legacy.data?.characters ?? []), ...(cmode.data?.legends ?? [])]);
  const maps = mergeUsage([...(legacy.data?.stages ?? []), ...(cmode.data?.maps ?? [])]);
  const games = Number(legacy.data?.gamesPlayed ?? 0) + Number(cmode.data?.gamesPlayed ?? 0);
  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold text-slate-500">
        {number(games)} recorded games across start.gg and Challengermode. Both providers report game winners when a match's games were reported; for Challengermode sets with only a set score, sweeps and each set's deciding game still count.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <UsageGrid title="Legends" rows={legends} kind="legend" legendName={legendName} empty="No legends reported" />
        <UsageGrid title="Stages" rows={maps} kind="map" empty="No stages reported" />
      </div>
    </div>
  );
}


function Rankings({ playerId, latest, history }) {
  const boards = latest
    .filter((entry) => entry.source_filter === "all" && entry.region !== "ALL")
    .sort((left, right) => (left.region === "ALL") - (right.region === "ALL") || left.region.localeCompare(right.region) || left.game_mode - right.game_mode);
  const regional = boards.find((entry) => entry.region !== "ALL") ?? boards[0];
  const [selected, setSelected] = useState(regional ? `${regional.region}:${regional.game_mode}` : "NA:1");
  const [region, mode] = selected.split(":");
  const series = history
    .filter((entry) => entry.source_filter === "all" && entry.region === region && String(entry.game_mode) === mode)
    .sort((left, right) => new Date(left.generated_at) - new Date(right.generated_at));

  return (
    <div className="grid gap-4">
      {boards.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
          {boards.map((entry) => {
            const key = `${entry.region}:${entry.game_mode}`;
            return (
              <button key={key} type="button" onClick={() => setSelected(key)} className={`rounded-xl border p-4 text-left transition ${selected === key ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900"}`}>
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">{regionName(entry.region)} · {modeName(entry.game_mode)}{entry.provisional ? " · provisional" : ""}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-950 dark:text-white">#{entry.rank}</span>
                  <span className="text-sm font-semibold text-slate-500">{Number(entry.points).toFixed(3)} pts</span>
                </div>
                {entry.previous_rank != null && <RankChange rank={entry.rank} previous={entry.previous_rank} />}
              </button>
            );
          })}
        </div>
      ) : <Card><Empty>Not ranked in the current season.</Empty></Card>}
      <div className="grid items-start gap-4 2xl:grid-cols-2">
        <Card title={`Rank over time · ${regionName(region)} ${modeName(mode)}`}><RankChart series={series} /></Card>
        <SeasonRankings playerId={playerId} region={region} mode={mode} />
      </div>
    </div>
  );
}

function SeasonRankings({ playerId, region: initialRegion, mode: initialMode }) {
  const [region, setRegion] = useState(initialRegion);
  const [mode, setMode] = useState(initialMode);
  const [presetId, setPresetId] = useState("current");
  useEffect(() => { setRegion(initialRegion); setMode(initialMode); }, [initialRegion, initialMode]);
  const presets = useApi(apiUrl("/ranking-presets", { region, gameMode: mode }));
  const season = useApi(apiUrl(`/players/${playerId}/season-ranking`, { region, gameMode: mode, presetId }));
  const data = season.data;
  return (
    <Card title="Rankings over time">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Select label="Region" value={region} onChange={setRegion} options={[["NA", "North America"], ["EU", "Europe"], ["SA", "South America"], ["SEA", "Southeast Asia"], ["AUS", "Australia"], ["MENA", "Middle East"]]} />
        <Select label="Format" value={mode} onChange={setMode} options={[["1", "1v1"], ["2", "2v2"]]} />
        <Select label="Preset" value={presetId} onChange={setPresetId} options={(presets.data?.presets ?? [{ id: "current", latest: "Current" }]).map((preset) => [preset.id, preset.current ? `Current · ${preset.latest}` : preset.latest])} />
      </div>
      {season.error && <ErrorNote message={season.error} />}
      {!data && season.loading && <Loading />}
      {data && (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-4">
            <span className="text-4xl font-black text-slate-950 dark:text-white">{data.rank ? `#${data.rank}` : "Unranked"}</span>
            {data.rank && <span className="text-sm font-bold text-slate-500">{points(data.points)} pts · {data.eventCount} events</span>}
            {data.rank && data.previousRank != null && <RankChange rank={data.rank} previous={data.previousRank} />}
          </div>
          {data.rank && <ContributionList contributions={data.contributions ?? []} asOf={data.preset?.current ? undefined : data.preset?.asOf} />}
        </>
      )}
    </Card>
  );
}

function RankChart({ series }) {
  if (series.length < 2) return <Empty>Not enough ranking history yet.</Empty>;
  const width = 720;
  const height = 220;
  const ranks = series.map((entry) => entry.rank);
  const worst = Math.max(...ranks);
  const x = (index) => 32 + (index / (series.length - 1)) * (width - 56);
  const y = (rank) => 16 + ((rank - 1) / Math.max(1, worst - 1)) * (height - 44);
  const path = series.map((entry, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(entry.rank).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Rank over time">
      <line x1="32" x2={width - 24} y1={y(1)} y2={y(1)} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="4 4" />
      <path d={path} fill="none" className="stroke-blue-500" strokeWidth="2.5" strokeLinejoin="round" />
      {series.map((entry, index) => (
        <circle key={entry.snapshot_id ?? index} cx={x(index)} cy={y(entry.rank)} r="3.5" className="fill-blue-500">
          <title>{`#${entry.rank} on ${date(entry.generated_at)}`}</title>
        </circle>
      ))}
      <text x="32" y={height - 4} className="fill-slate-500 text-[11px] font-bold">{date(series[0].generated_at)}</text>
      <text x={width - 24} y={height - 4} textAnchor="end" className="fill-slate-500 text-[11px] font-bold">{date(series[series.length - 1].generated_at)}</text>
      <text x="4" y={y(1) + 4} className="fill-slate-500 text-[11px] font-bold">#1</text>
      <text x="4" y={y(worst) + 4} className="fill-slate-500 text-[11px] font-bold">#{worst}</text>
    </svg>
  );
}


function Appearances({ events, initial }) {
  const [mode, setMode] = useState(initial.mode ?? "all");
  const [scope, setScope] = useState("all");
  const [year, setYear] = useState(initial.year ?? "all");
  const [finish, setFinish] = useState(initial.finish ?? "all");
  const [prize, setPrize] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 100;
  const years = useMemo(() => [...new Set(events.map((event) => new Date(event.starts_at).getFullYear()).filter(Number.isFinite))], [events]);
  const term = search.trim().toLowerCase();
  const filtered = events
    .filter((event) => mode === "all" || modeKey(event.game_mode) === mode)
    .filter((event) => scope === "all" || (scope === "official") === Boolean(event.is_official))
    .filter((event) => year === "all" || new Date(event.starts_at).getFullYear() === Number(year))
    .filter((event) => finish === "all" || (confirmed(event) && FINISHES[finish](Number(event.placement))))
    .filter((event) => prize === "all" || Number(event.recorded_prize_usd) > 0)
    .filter((event) => !term || `${event.tournament_name} ${event.event_name}`.toLowerCase().includes(term));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <Card padded={false}>
      <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-3 xl:grid-cols-[minmax(14rem,2fr)_repeat(5,minmax(8rem,1fr))]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Search</span>
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Find a tournament" />
        </label>
        <Select label="Format" value={mode} onChange={reset(setMode)} options={[["all", "All formats"], ...MODES]} />
        <Select label="Type" value={scope} onChange={reset(setScope)} options={[["all", "All tournaments"], ["official", "Official"], ["community", "Community"]]} />
        <Select label="Year" value={year} onChange={reset(setYear)} options={[["all", "All years"], ...years.map((value) => [String(value), String(value)])]} />
        <Select label="Finish" value={finish} onChange={reset(setFinish)} options={[["all", "Any finish"], ["gold", "Gold"], ["silver", "Silver"], ["bronze", "Bronze"], ["top8", "Top 8"], ["top16", "Top 16"], ["top32", "Top 32"]]} />
        <Select label="Prize" value={prize} onChange={reset(setPrize)} options={[["all", "Any"], ["won", "Won prize money"]]} />
      </div>
      <div className="px-4 py-2 text-xs font-bold text-slate-500">{number(filtered.length)} of {number(events.length)} events</div>
      {!filtered.length && <Empty>No results match these filters.</Empty>}
      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800">
                <th className="px-4 py-2">Date</th>
                <th className="w-14" />
                <th className="px-2 py-2">Tournament</th>
                <th className="px-2 py-2">Format</th>
                <th className="px-2 py-2 text-right">Seed</th>
                <th className="px-2 py-2 text-right">Place</th>
                <th className="px-2 py-2 text-right">Sets</th>
                <th className="px-4 py-2 text-right">Prize</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => (
                <tr key={`${event.event_id}:${event.entrant_id}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-500">{date(event.starts_at)}</td>
                  <td className="w-14 py-2"><EventImage src={event.tournament_image} name={event.tournament_name} size="h-10 w-10" /></td>
                  <td className="max-w-xl px-2 py-2.5">
                    <a href={`/esports/event/${event.event_id}`} className="block truncate font-black text-slate-950 hover:text-blue-500 dark:text-white">{event.tournament_name}</a>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      {event.event_name !== event.tournament_name && <span className="truncate">{event.event_name}</span>}
                      {event.is_official && <Badge tone="blue">Official</Badge>}
                      {event.game_mode === 2 && event.entrant_name && <span className="truncate">Team: {event.entrant_name.replace(/'s party$/i, "")}</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 font-bold text-slate-600 dark:text-slate-300">{modeName(event.game_mode)}{event.region ? ` · ${event.region}` : ""}</td>
                  <td className="px-2 py-2.5 text-right font-semibold text-slate-500">{event.seed ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">
                    <span className={`font-black ${Number(event.placement) <= 3 && confirmed(event) ? "text-amber-500" : "text-slate-950 dark:text-white"}`}>{event.disqualified ? "DQ" : ordinal(event.placement)}</span>
                    {event.entrant_count > 0 && <span className="text-xs font-semibold text-slate-500"> / {number(event.entrant_count)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right font-bold tabular-nums text-slate-600 dark:text-slate-300">
                    {event.setStats?.playedSets ? `${event.setStats.wins}–${event.setStats.losses}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    {Number(event.recorded_prize_usd) > 0 ? money(event.recorded_prize_usd) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Math.ceil(filtered.length / perPage)} onChange={setPage} />
    </Card>
  );
}
