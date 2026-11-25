import React, { useMemo, useState } from "react";
import { host } from "../../stuff";
import { rankedLegendHref, rankedPlayerHref } from "../raybot/raybot";
import { Card, ScrollX, EmptyState, FullOnly, Img, ImgPlaceholder, LoadingState, Pagination, RawData, Section, SelectInput, foldText, formatNumber, legendHref, portraitUrl, useApi, useDataView, useGameNames } from "../ui";

export const legendUsageKey = (name) => foldText(name).replace(/[^a-z0-9]/g, "");

const pct = (value, digits = 1) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? "–" : `${(Number(value) * 100).toFixed(digits)}%`);

const monthLabel = (month) => {
  const [year, index] = String(month).split("-").map(Number);
  if (!year || !index) return month;
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
};

const sortOptions = [
  { value: "peak", label: "Best peak" },
  { value: "rating", label: "Rating" },
  { value: "winrate", label: "Win rate" },
  { value: "games", label: "Games" },
  { value: "xp", label: "XP" },
];

const minGameOptions = [
  { value: "100", label: "100+ games" },
  { value: "500", label: "500+ games" },
  { value: "1000", label: "1,000+ games" },
  { value: "0", label: "Any" },
];

function useLegendLookup() {
  const names = useGameNames();
  return useMemo(() => {
    const byKey = new Map();
    for (const legend of names.legends || []) {
      if (legend?.name) byKey.set(legendUsageKey(legend.name), legend.name);
      if (legend?.code) byKey.set(legendUsageKey(legend.code), byKey.get(legendUsageKey(legend.code)) || legend.name);
    }
    return (key) => byKey.get(key) || key;
  }, [names]);
}

export function useLegendUsage(legend) {
  const key = legendUsageKey(legend?.bio?.name?.normal);
  return useApi(key ? `${host}/v2/esports/legends/${encodeURIComponent(key)}/usage` : "");
}

export function useLegendRanked(legend) {
  const id = Number(legend?.id);
  return useApi(Number.isInteger(id) && id > 0 ? `${host}/v2/raybot/legends/${id}/summary` : "");
}

function Stat({ label, value, note }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate text-base font-black tabular-nums text-white">{value}</div>
      {note && <div className="truncate text-[11px] text-slate-400">{note}</div>}
    </div>
  );
}

function Quiet({ children }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

function TournamentStats({ usage, compact = false }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? "sm:grid-cols-4 min-[118.75rem]:grid-cols-2" : "sm:grid-cols-4"}`}>
      <Stat label="Picks" value={formatNumber(usage.picks)} note={`${pct(usage.share)} of all picks`} />
      <Stat label="Pick rank" value={usage.rank ? `#${usage.rank}` : "–"} note={`of ${formatNumber(usage.legendsPicked)} legends`} />
      <Stat label="Won" value={pct(usage.winRate, 0)} note={`${formatNumber(usage.known)} games with a result`} />
      <Stat label="Players" value={formatNumber(usage.players)} note={`${formatNumber(usage.tournaments)} tournaments`} />
    </div>
  );
}

function RankedStats({ ranked, compact = false }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? "sm:grid-cols-4 min-[118.75rem]:grid-cols-2" : "sm:grid-cols-4"}`}>
      <Stat label="Players" value={formatNumber(ranked.players)} note={`${formatNumber(ranked.regulars)} with 100+ games`} />
      <Stat label="Rank" value={`#${ranked.rank}`} note={`of ${formatNumber(ranked.legends)} by games`} />
      <Stat label="Win rate" value={pct(ranked.winRate)} note={`${formatNumber(ranked.games)} games`} />
      <Stat label="Top peak" value={ranked.topPeak ? formatNumber(ranked.topPeak) : "–"} note={ranked.highPeaks ? `${formatNumber(ranked.highPeaks)} peaked 2,000+` : undefined} />
    </div>
  );
}

function PlayerRows({ players, limit }) {
  return (
    <ol className="grid gap-0.5 text-sm">
      {players.slice(0, limit).map((player, index) => (
        <li key={player.playerId} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-slate-800/50">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-500">{index + 1}</span>
          <a href={`/esports/player/id/${player.playerId}`} className="min-w-0 flex-1 truncate font-bold text-white hover:text-blue-200">{player.name}</a>
          <span className="shrink-0 tabular-nums text-slate-300">{formatNumber(player.picks)} {player.picks === 1 ? "pick" : "picks"}</span>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400" title="Won">{player.known > 0 ? pct(player.winRate, 0) : "–"}</span>
        </li>
      ))}
    </ol>
  );
}

function RankedRows({ rows }) {
  return (
    <ol className="grid gap-0.5 text-sm">
      {rows.map((row) => (
        <li key={row.bhid} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-slate-800/50">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-500">{row.rank}</span>
          <a href={rankedPlayerHref(row.bhid)} className="min-w-0 flex-1 truncate font-bold text-white hover:text-blue-200">{row.name}</a>
          <span className="shrink-0 tabular-nums text-slate-300">{row.peakAllTime ? formatNumber(row.peakAllTime) : "–"}</span>
        </li>
      ))}
    </ol>
  );
}

export function WhoPlaysCard({ legend, onMore }) {
  const usage = useLegendUsage(legend);
  const ranked = useLegendRanked(legend);
  const id = Number(legend?.id);
  const top = useApi(Number.isInteger(id) && id > 0 ? `${host}/v2/raybot/legends/${id}/leaderboard?sort=peak&perPage=5` : "");
  const more = <button type="button" onClick={onMore} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-blue-200 hover:bg-slate-700">More</button>;
  return (
    <Section title="Who plays it" headingAs="h2" actions={more} bodyClassName="grid gap-3 p-3 lg:grid-cols-2 min-[118.75rem]:grid-cols-1 min-[137.5rem]:grid-cols-2" padded={false}>
      <div className="min-w-0 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-blue-200">Tournaments, last 90 days</h3>
        {usage.loading && !usage.data ? <LoadingState bare inline label="Loading picks" /> : usage.error ? <Quiet>Tournament picks aren't available right now.</Quiet> : usage.data?.picks ? (
          <>
            <TournamentStats usage={usage.data} compact />
            {!!usage.data.topPlayers.length && <PlayerRows players={usage.data.topPlayers} limit={5} />}
          </>
        ) : <Quiet>No tournament picks in the last 90 days.</Quiet>}
      </div>
      <div className="min-w-0 space-y-2 border-t border-slate-800 pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0 min-[118.75rem]:border-l-0 min-[118.75rem]:border-t min-[118.75rem]:pl-0 min-[118.75rem]:pt-3 min-[137.5rem]:border-l min-[137.5rem]:border-t-0 min-[137.5rem]:pl-3 min-[137.5rem]:pt-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-blue-200">Ranked</h3>
          <a href={rankedLegendHref(legend?.bio?.name?.normal)} className="text-xs font-bold text-blue-300 hover:underline">Leaderboard</a>
        </div>
        {ranked.loading && !ranked.data ? <LoadingState bare inline label="Loading ranked" /> : ranked.error || !ranked.data ? <Quiet>Ranked numbers aren't available right now.</Quiet> : (
          <>
            <RankedStats ranked={ranked.data} compact />
            {!!top.data?.rows?.length && <RankedRows rows={top.data.rows} />}
          </>
        )}
      </div>
    </Section>
  );
}

function MonthBars({ months }) {
  const max = Math.max(0, ...months.map((month) => Number(month.share) || 0));
  if (!max) return <Quiet>No picks in the last 12 months.</Quiet>;
  return (
    <div className="grid grid-cols-12 items-end gap-1">
      {months.map((month) => (
        <div key={month.month} className="flex min-w-0 flex-col items-center gap-1" title={`${month.month}: ${formatNumber(month.picks)} of ${formatNumber(month.total)} picks${month.known ? `, won ${pct(month.winRate, 0)}` : ""}`}>
          <span className="text-[10px] tabular-nums text-slate-400">{month.picks ? pct(month.share, 1) : ""}</span>
          <div className="flex h-24 w-full items-end rounded bg-slate-950/60">
            <div className="w-full rounded bg-blue-500/70" style={{ height: `${Math.max(month.picks ? 3 : 0, ((Number(month.share) || 0) / max) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-slate-400">{monthLabel(month.month)}</span>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ head, children, minWidth = "min-w-[20rem]" }) {
  return (
    <ScrollX>
      <table className={`w-full ${minWidth} text-sm`}>
        <thead>
          <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
            {head.map(([label, align]) => <th key={label} className={`px-2 py-1.5 ${align === "right" ? "text-right" : ""}`}>{label}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </ScrollX>
  );
}

function OpponentTable({ opponents, legendName }) {
  if (!opponents.length) return <Quiet>No games with a known opponent.</Quiet>;
  return (
    <SimpleTable head={[["Against"], ["Games", "right"], ["Won", "right"]]}>
      {opponents.map((row) => (
        <tr key={row.legend} className="border-t border-slate-800">
          <td className="px-2 py-1">
            <span className="flex min-w-0 items-center gap-2">
              <Img src={portraitUrl({ name: legendName(row.legend) })} alt="" className="h-6 w-6 shrink-0 rounded bg-slate-950 object-contain" fallback={<ImgPlaceholder className="h-6 w-6 shrink-0 rounded" />} />
              <a href={legendHref(legendName(row.legend))} className="truncate font-bold text-white hover:text-blue-200">{legendName(row.legend)}</a>
            </span>
          </td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-200">{formatNumber(row.games)}</td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-300">{row.known ? pct(row.winRate, 0) : "–"}</td>
        </tr>
      ))}
    </SimpleTable>
  );
}

function RegionTable({ regions }) {
  if (!regions.length) return <Quiet>No region data.</Quiet>;
  return (
    <SimpleTable minWidth="" head={[["Region"], ["Picks", "right"], ["Share", "right"], ["Won", "right"]]}>
      {regions.map((row) => (
        <tr key={row.region} className="border-t border-slate-800">
          <td className="px-2 py-1 font-bold text-white">{row.region}</td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-200">{formatNumber(row.picks)}</td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-300">{pct(row.share)}</td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-300">{row.known ? pct(row.winRate, 0) : "–"}</td>
        </tr>
      ))}
    </SimpleTable>
  );
}

function TournamentSection({ legend, usage }) {
  const legendName = useLegendLookup();
  const key = legendUsageKey(legend?.bio?.name?.normal);
  const link = <a href={`/esports/match-data?legend=${encodeURIComponent(key)}&period=90d`} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-blue-200 hover:bg-slate-700">Match Data</a>;
  const data = usage.data;
  return (
    <Section title="Tournaments" count="last 90 days" headingAs="h2" actions={link} padded={false} bodyClassName="space-y-3 p-3">
      {usage.loading && !data ? <LoadingState label="Loading tournament picks" rows={3} /> : usage.error ? <Quiet>Tournament picks aren't available right now.</Quiet> : !data?.picks ? <Quiet>No tournament picks in the last 90 days.</Quiet> : (
        <>
          <TournamentStats usage={data} />
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-2">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-200">Most picks</h3>
              {data.topPlayers.length ? <PlayerRows players={data.topPlayers} limit={8} /> : <Quiet>No players linked to these picks.</Quiet>}
            </Card>
            <Card className="p-2">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-200">Opponents</h3>
              <OpponentTable opponents={data.opponents} legendName={legendName} />
            </Card>
          </div>
          <FullOnly>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card className="p-2">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-200">Share of picks by month</h3>
                <MonthBars months={data.months} />
              </Card>
              <Card className="space-y-2 p-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-blue-200">By region</h3>
                <RegionTable regions={data.regions} />
                <p className="text-xs text-slate-400">1v1 {formatNumber(data.modes.ones)} picks, 2v2 {formatNumber(data.modes.twos)}.</p>
              </Card>
            </div>
            <p className="max-w-prose text-xs text-slate-400">Picks from start.gg and Challengermode games that report legends, by tournament start date. Won counts games with a known winner and leaves out mirror matches.</p>
            <RawData data={data} title="Raw tournament data" source={`${host}/v2/esports/legends/${key}/usage`} filename={`${key}-usage.json`} />
          </FullOnly>
        </>
      )}
    </Section>
  );
}

function LeaderboardTable({ rows }) {
  return (
    <SimpleTable minWidth="min-w-[30rem]" head={[["#", "right"], ["Player"], ["Peak", "right"], ["Rating", "right"], ["Games", "right"], ["Win rate", "right"]]}>
      {rows.map((row) => (
        <tr key={row.bhid} className="border-t border-slate-800">
          <td className="px-2 py-1 text-right tabular-nums text-slate-500">{row.rank}</td>
          <td className="max-w-[14rem] truncate px-2 py-1"><a href={rankedPlayerHref(row.bhid)} className="font-bold text-white hover:text-blue-200">{row.name}</a></td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-200">{row.peakAllTime ? formatNumber(row.peakAllTime) : "–"}</td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-300">{row.rating ? formatNumber(row.rating) : "–"}</td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-300">{formatNumber(row.games)}</td>
          <td className="px-2 py-1 text-right tabular-nums text-slate-300">{row.games ? pct(row.wins / row.games) : "–"}</td>
        </tr>
      ))}
    </SimpleTable>
  );
}

function RankedSection({ legend, ranked }) {
  const { full } = useDataView();
  const [sort, setSort] = useState("peak");
  const [minGames, setMinGames] = useState("100");
  const [page, setPage] = useState(1);
  const id = Number(legend?.id);
  const perPage = full ? 25 : 10;
  const query = full ? `sort=${sort}&minGames=${minGames}&page=${page}&perPage=${perPage}` : `sort=peak&perPage=${perPage}`;
  const board = useApi(Number.isInteger(id) && id > 0 ? `${host}/v2/raybot/legends/${id}/leaderboard?${query}` : "");
  const totalPages = board.data ? Math.min(1000, Math.ceil(board.data.total / perPage)) : 0;
  const boardLink = <a href={rankedLegendHref(legend?.bio?.name?.normal)} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-blue-200 hover:bg-slate-700">Full leaderboard</a>;
  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {full && !board.error && (
        <>
          <SelectInput label="Sort" value={sort} onChange={(value) => { setSort(value); setPage(1); }} options={sortOptions} />
          <SelectInput label="Games" value={minGames} onChange={(value) => { setMinGames(value); setPage(1); }} options={minGameOptions} />
        </>
      )}
      {boardLink}
    </div>
  );
  return (
    <Section title="Ranked" headingAs="h2" actions={controls} padded={false} bodyClassName="space-y-3 p-3">
      {ranked.loading && !ranked.data ? <LoadingState label="Loading ranked numbers" rows={3} /> : ranked.error || !ranked.data ? <Quiet>Ranked numbers aren't available right now.</Quiet> : <RankedStats ranked={ranked.data} />}
      {board.loading && !board.data ? null : board.error ? null : board.data?.rows?.length ? (
        <>
          <LeaderboardTable rows={board.data.rows} />
          {full && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
        </>
      ) : board.data ? <EmptyState bare title="No players on this board" /> : null}
      <FullOnly>
        <p className="max-w-prose text-xs text-slate-400">Players Raybot has saved, as of their last save. Games and win rate count every mode, and the win rate is theirs, not the whole player base. Ratings are 1v1 ranked.{ranked.data?.updatedAt ? ` Updated ${new Date(ranked.data.updatedAt).toLocaleString()}.` : ""}</p>
      </FullOnly>
    </Section>
  );
}

export function PlayersTab({ legend }) {
  const usage = useLegendUsage(legend);
  const ranked = useLegendRanked(legend);
  return (
    <div className="grid gap-3 2xl:grid-cols-2">
      <TournamentSection legend={legend} usage={usage} />
      <RankedSection legend={legend} ranked={ranked} />
    </div>
  );
}
