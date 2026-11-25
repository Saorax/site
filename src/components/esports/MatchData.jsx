import { useId, useMemo, useState } from "react";
import { host } from "../../stuff";
import { legendKey, mapName as rawMapName, useLegendNames, useLegendWeapons } from "./MatchPages";
import { Card, cleanEntrantName, Empty, number, Pagination, percent, Select, useQueryState } from "./ui";
import { ScrollX, weaponIconUrl, weaponName } from "../ui";

export const mapName = (value) => rawMapName(value).replace(/^Small\s+/i, "");
const legendArt = (name) => `${host}/game/legends/art/${encodeURIComponent(name ?? "")}`;
const mapArt = (name) => `${host}/game/maps/thumbnail/${encodeURIComponent(name ?? "")}`;
const hide = (event) => { event.currentTarget.style.visibility = "hidden"; };
const mapKey = (value) => String(value ?? "").normalize("NFD").toLowerCase().replace(/^small\s+/, "").replace(/[^a-z0-9]/g, "").replace(/ofthe/g, "of");
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
export const plural = (count, word) => `${number(count)} ${word}${count === 1 ? "" : "s"}`;

export const gamePicks = (game) => [game?.entrantSelections, game?.selections, game?.picks].find((list) => Array.isArray(list) && list.length) ?? [];

export const hasMatchData = (game) => Boolean(text(game?.map)) || gamePicks(game).some((pick) => text(pick?.legend));

export const matchDataGames = (sets) => (sets ?? []).reduce((total, set) => total + (set.games ?? []).filter(hasMatchData).length, 0);

function scoreWinner(gameNumber, slots) {
  const scores = slots.map((slot) => (slot?.score == null ? null : Number(slot.score)));
  if (scores.length !== 2 || !scores.every((score) => Number.isInteger(score) && score >= 0) || scores[0] === scores[1]) return -1;
  const total = scores[0] + scores[1];
  if (gameNumber < 1 || gameNumber > total) return -1;
  return Math.min(...scores) === 0 || gameNumber === total ? (scores[0] > scores[1] ? 0 : 1) : -1;
}

function collectGames(sets, entrants) {
  const byId = new Map();
  const byProvider = new Map();
  const byAccount = new Map();
  for (const entrant of entrants) {
    byId.set(String(entrant.id), entrant);
    if (entrant.provider_entrant_id != null) byProvider.set(String(entrant.provider_entrant_id), entrant);
    for (const member of entrant.members ?? []) {
      if (member.gameAccountId) byAccount.set(String(member.gameAccountId), { entrant, member });
    }
  }
  const games = [];
  for (const set of sets) {
    const slots = set.slots ?? [];
    if (slots.length !== 2) continue;
    const sideOf = (entrantId) => (entrantId == null ? -1 : slots.findIndex((slot) => String(slot.entrantId) === String(entrantId)));
    const sideEntrants = slots.map((slot) => byId.get(String(slot.entrantId)) ?? null);
    const solo = (side) => (sideEntrants[side]?.members?.length === 1 ? sideEntrants[side].members[0] : null);
    const learned = new Map();
    const byName = new Map();
    sideEntrants.forEach((entrant, side) => {
      for (const member of entrant?.members ?? []) if (text(member.name)) byName.set(member.name.trim().toLowerCase(), { side, member });
    });
    const read = (game, index) => {
      const gameNumber = Number(game.gameNumber ?? game.number) || index + 1;
      const sides = [[], []];
      const loose = [];
      const pick = (legend, member, name, account) => ({
        legend, key: legendKey(legend), playerId: member?.playerId ?? null, playerName: member?.name ?? name ?? null, account,
      });
      if (game.entrantSelections?.length) {
        for (const selection of game.entrantSelections) {
          const legend = text(selection?.legend);
          const side = sideOf(byProvider.get(String(selection?.providerEntrantId))?.id);
          if (legend) (side >= 0 ? sides[side] : loose).push(pick(legend, side >= 0 ? solo(side) : null));
        }
      } else if (game.selections?.length) {
        for (const selection of game.selections) {
          const legend = text(selection?.legend);
          const accountId = selection?.gameAccountId == null ? null : String(selection.gameAccountId);
          const account = accountId ? byAccount.get(accountId) : null;
          const known = sideOf(account?.entrant.id);
          const named = known < 0 ? byName.get(String(text(selection?.name) ?? "").toLowerCase()) : null;
          const side = known >= 0 ? known : (named?.side ?? learned.get(accountId) ?? -1);
          if (legend) (side >= 0 ? sides[side] : loose).push(pick(legend, account?.member ?? named?.member, text(selection?.name), accountId));
        }
      } else {
        for (const selection of game.picks ?? []) {
          const legend = text(selection?.legend);
          const side = sideOf(selection?.entrantId);
          if (legend) (side >= 0 ? sides[side] : loose).push(pick(legend, side >= 0 ? solo(side) : null));
        }
      }
      const teamSize = (sides[0].length + sides[1].length + loose.length) / 2;
      const short = [0, 1].filter((side) => sides[side].length < teamSize);
      if (loose.length && short.length === 1 && Number.isInteger(teamSize)) {
        for (const entry of loose) if (entry.account) learned.set(entry.account, short[0]);
        sides[short[0]].push(...loose);
        loose.length = 0;
      }
      return { gameNumber, sides, loose };
    };
    const list = (set.games ?? []).map((game, index) => [game, index]).filter(([game]) => game && typeof game === "object" && hasMatchData(game));
    for (let pass = 0; pass < 2; pass++) for (const [game, index] of list) read(game, index);
    for (const [game, index] of list) {
      const { gameNumber, sides, loose } = read(game, index);
      const winnerId = game.winnerProviderEntrantId != null
        ? byProvider.get(String(game.winnerProviderEntrantId))?.id
        : game.winnerEntrantId;
      const winner = winnerId != null ? sideOf(winnerId) : scoreWinner(gameNumber, slots);
      const map = text(game.map);
      games.push({
        id: `${set.id}:${gameNumber}`,
        set,
        number: gameNumber,
        map,
        mapKey: map ? mapKey(map) : null,
        sides,
        unplaced: loose.length,
        winner,
        entrantIds: slots.map((slot) => String(slot.entrantId)),
        names: slots.map((slot, side) => slot.entrantName ?? sideEntrants[side]?.name ?? "TBD"),
      });
    }
  }
  return games.sort((left, right) => (left.set.set_order ?? 0) - (right.set.set_order ?? 0) || String(left.set.id).localeCompare(String(right.set.id)) || left.number - right.number);
}

const outcome = (game, side) => (game.winner < 0 ? null : game.winner === side);
const ensure = (rows, key, make) => {
  let row = rows.get(key);
  if (!row) { row = make(); rows.set(key, row); }
  return row;
};
const record = (row, won) => {
  row.games++;
  if (won !== null) { row.known++; if (won) row.wins++; }
  return row;
};
const byGames = (left, right) => right.games - left.games || right.wins - left.wins || String(left.name).localeCompare(String(right.name));
const counted = (rows) => [...rows.values()].sort(byGames);

export function buildSummary(games) {
  const legends = new Map();
  const maps = new Map();
  const legendMaps = new Map();
  const pairs = new Map();
  const byGame = new Map();
  const legendPlayers = new Map();
  const sets = new Set();
  let picks = 0;
  let withMap = 0;
  let decided = 0;
  for (const game of games) {
    sets.add(game.set.id);
    if (game.winner >= 0) decided++;
    if (game.map) {
      withMap++;
      ensure(maps, game.mapKey, () => ({ key: game.mapKey, name: game.map, games: 0, wins: 0, known: 0 })).games++;
      const slot = Math.min(game.number, 3);
      ensure(byGame, `${slot}|${game.mapKey}`, () => ({ game: slot, map: game.mapKey, count: 0 })).count++;
    }
    const seen = new Set();
    game.sides.forEach((side, index) => {
      const won = outcome(game, index);
      for (const pick of side) {
        picks++;
        const row = record(ensure(legends, pick.key, () => ({ key: pick.key, name: pick.legend, games: 0, gamesWith: 0, wins: 0, known: 0, people: new Set() })), won);
        if (!seen.has(pick.key)) { seen.add(pick.key); row.gamesWith++; }
        const who = pick.playerId ?? pick.playerName;
        if (who) {
          row.people.add(String(who));
          ensure(legendPlayers, `${pick.key}|${who}`, () => ({ legend: pick.key, playerId: pick.playerId, name: pick.playerName ?? "", count: 0 })).count++;
        }
        if (game.map) ensure(legendMaps, `${pick.key}|${game.mapKey}`, () => ({ legend: pick.key, map: game.mapKey, count: 0 })).count++;
      }
    });
    for (const left of game.sides[0]) {
      for (const right of game.sides[1]) {
        const [first, second, firstSide] = left.key <= right.key ? [left, right, 0] : [right, left, 1];
        const row = ensure(pairs, `${first.key}|${second.key}`, () => ({ a: first.key, b: second.key, aName: first.legend, bName: second.legend, games: 0, wins: 0, known: 0 }));
        if (first.key === second.key) row.games++;
        else record(row, outcome(game, firstSide));
      }
    }
  }
  const topPlayers = new Map();
  for (const entry of legendPlayers.values()) {
    const best = topPlayers.get(entry.legend);
    if (!best || entry.count > best.count) topPlayers.set(entry.legend, entry);
  }
  return {
    totals: { games: games.length, sets: sets.size, picks, withMap, decided, legends: legends.size, maps: maps.size },
    legends: counted(legends).map(({ people, ...row }) => ({ ...row, players: people.size, topPlayer: topPlayers.get(row.key) ?? null })),
    maps: counted(maps),
    legendMaps: [...legendMaps.values()],
    pairs: counted(pairs),
    byGame: [...byGame.values()],
  };
}

export function buildFocus(games, focusSide) {
  const legends = new Map();
  const against = new Map();
  const maps = new Map();
  let total = 0;
  let mirrors = 0;
  for (const game of games) {
    const focus = focusSide(game);
    if (focus < 0) { mirrors++; continue; }
    total++;
    const won = outcome(game, focus);
    for (const pick of game.sides[focus]) record(ensure(legends, pick.key, () => ({ key: pick.key, name: pick.legend, games: 0, wins: 0, known: 0 })), won);
    for (const pick of game.sides[1 - focus]) record(ensure(against, pick.key, () => ({ key: pick.key, name: pick.legend, games: 0, wins: 0, known: 0 })), won);
    if (game.map) record(ensure(maps, game.mapKey, () => ({ key: game.mapKey, name: game.map, games: 0, wins: 0, known: 0 })), won);
  }
  return { games: total, mirrors, legends: counted(legends), against: counted(against), maps: counted(maps) };
}

function entrantRows(games, entrants) {
  const byId = new Map(entrants.map((entrant) => [String(entrant.id), entrant]));
  const rows = new Map();
  for (const game of games) {
    game.entrantIds.forEach((id, side) => {
      const entrant = byId.get(id) ?? null;
      const solo = entrant?.members?.length === 1 ? entrant.members[0] : null;
      const row = record(ensure(rows, id, () => ({ key: id, name: game.names[side], playerId: solo?.playerId ?? null, placement: entrant?.placement ?? null, games: 0, wins: 0, known: 0, picks: new Map() })), outcome(game, side));
      for (const pick of game.sides[side]) ensure(row.picks, pick.key, () => ({ key: pick.key, name: pick.legend, count: 0 })).count++;
    });
  }
  return counted(rows).map(({ picks, ...row }) => ({ ...row, legends: [...picks.values()].sort((left, right) => right.count - left.count) }));
}

const PALETTE = ["#3b82f6", "#f97316", "#10b981", "#eab308", "#ec4899", "#8b5cf6", "#64748b"];

function matchupIndex(pairs) {
  const index = new Map();
  const add = (key, entry) => { if (!index.has(key)) index.set(key, []); index.get(key).push(entry); };
  for (const pair of pairs) {
    if (pair.a === pair.b) continue;
    add(pair.a, { key: pair.b, name: pair.bName, games: pair.games, wins: pair.wins, known: pair.known });
    add(pair.b, { key: pair.a, name: pair.aName, games: pair.games, wins: pair.known - pair.wins, known: pair.known });
  }
  return index;
}

const rateOf = (row) => (row.known ? row.wins / row.known : null);

function MoreToggle({ total, limit, step, onChange }) {
  if (total <= step) return null;
  const all = limit >= total;
  return (
    <button type="button" onClick={() => onChange(all ? step : total)} className="w-full rounded-lg py-1.5 text-xs font-black transition bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white">
      {all ? "Show fewer" : `Show all ${number(total)}`}
    </button>
  );
}

export function StatStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {items.filter(Boolean).map((item) => (
        <div key={item.label} className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 border-slate-800 bg-slate-900/80">
          {item.image && <img src={item.image} alt="" loading="lazy" onError={hide} className={`${item.wide ? "h-10 w-12" : "h-10 w-10"} shrink-0 rounded-lg object-cover bg-slate-800`} />}
          <div className="min-w-0">
            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className={`${item.image ? "line-clamp-2 text-sm" : "truncate text-xl"} font-black leading-tight tabular-nums text-white`} title={typeof item.value === "string" ? item.value : undefined}>{item.value}</div>
            {item.hint && <div className="truncate text-[11px] font-semibold text-slate-400">{item.hint}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

const bucketLabel = (at, unit) => {
  const value = new Date(`${at}T00:00:00Z`);
  return unit === "month" ? value.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : String(value.getUTCFullYear());
};

export function CoverageChart({ coverage }) {
  if (!coverage) return null;
  const rate = coverage.played ? coverage.reported / coverage.played : 0;
  const buckets = coverage.buckets.filter((bucket) => bucket.played > 0);
  const best = Math.max(0.01, ...buckets.map((bucket) => bucket.reported / bucket.played));
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div>
          <div className="text-3xl font-black leading-none tabular-nums text-emerald-400">{(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">of played sets have legends or maps reported</div>
        </div>
        <div className="text-right text-sm font-black tabular-nums text-white">
          {number(coverage.reported)} <span className="font-semibold text-slate-500">of {number(coverage.played)} sets</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, rate * 100)}%` }} /></div>
      {buckets.length > 1 && (
        <div className="grid gap-1">
          <div className="flex h-20 items-end gap-1">
            {buckets.map((bucket) => {
              const share = bucket.reported / bucket.played;
              return (
                <div key={bucket.at} className="flex h-full min-w-0 flex-1 flex-col justify-end rounded-sm bg-slate-800/60" title={`${bucketLabel(bucket.at, coverage.unit)}: ${number(bucket.reported)} of ${number(bucket.played)} sets (${Math.round(share * 100)}%)`}>
                  <div className="rounded-sm bg-emerald-500/80" style={{ height: `${Math.max(2, (share / best) * 100)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1">
            {buckets.map((bucket, index) => (
              <span key={bucket.at} className="min-w-0 flex-1 truncate text-center text-[10px] font-bold text-slate-500">
                {buckets.length > 14 && index % 2 ? "" : bucketLabel(bucket.at, coverage.unit)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function WinLine({ wins, known, games, compact = false }) {
  if (!known) return <span className="text-xs font-semibold text-slate-500">{compact ? "" : "no results"}</span>;
  const rate = (100 * wins) / known;
  return (
    <span className="grid min-w-[7rem] gap-0.5">
      <span className="flex justify-between gap-2 text-[11px] font-bold tabular-nums">
        <span className="text-sky-400">{number(wins)}W</span>
        <span className="text-slate-400">{rate.toFixed(0)}%{known < games ? ` of ${number(known)}` : ""}</span>
        <span className="text-rose-400">{number(known - wins)}L</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-rose-500/60"><span className="block h-full bg-sky-500" style={{ width: `${rate}%` }} /></span>
    </span>
  );
}

function Face({ legend, legendName, size = "h-8 w-8", dim = false, title }) {
  return (
    <img
      src={legendArt(legend)}
      alt={legendName(legend)}
      title={title ?? legendName(legend)}
      loading="lazy"
      onError={hide}
      className={`${size} shrink-0 rounded-md object-cover bg-slate-800 ${dim ? "opacity-50" : ""}`}
    />
  );
}

export function Coverage({ value, total, label }) {
  const rate = total > 0 ? Math.min(100, (100 * value) / total) : 0;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-black tabular-nums text-white">{number(value)}<span className="text-base text-slate-500"> / {number(total)}</span></span>
        <span className="text-sm font-black tabular-nums text-emerald-400">{percent(value, total)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} /></div>
      <div className="text-xs font-semibold text-slate-400">{label}</div>
    </div>
  );
}

export function Facts({ items }) {
  return (
    <dl className="grid divide-y divide-slate-800 text-sm">
      {items.filter(Boolean).map(([label, value, hint]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-1">
          <dt className="font-semibold text-slate-400">{label}</dt>
          <dd className="text-right font-black tabular-nums text-white">
            {value}
            {hint && <span className="ml-1 text-xs font-semibold text-slate-500">{hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TopPick({ label, image, wide = false, name, detail }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg p-1.5 bg-slate-950/60">
      <img src={image} alt="" loading="lazy" onError={hide} className={`${wide ? "h-9 w-14" : "h-9 w-9"} shrink-0 rounded-md object-cover bg-slate-800`} />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate text-sm font-black text-white" title={name}>{name}</div>
      </div>
      <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-slate-400">{detail}</span>
    </div>
  );
}

export function ReportedFacts({ summary, legendName, coverage }) {
  const totals = summary.totals;
  return (
    <div className="grid gap-2">
      {coverage}
      <Facts items={[
        ["Games", number(totals.games), totals.gamesOf != null ? `of ${number(totals.gamesOf)}` : null],
        totals.tournaments != null && ["Tournaments", number(totals.tournaments)],
        totals.sets > 0 && ["Games per set", (totals.games / totals.sets).toFixed(1)],
        ["Legend picks", number(totals.picks)],
        ["Legends used", number(totals.legends)],
        ["Games with a map", number(totals.withMap), percent(totals.withMap, totals.games)],
        ["Maps used", number(totals.maps)],
        ["Known game winners", number(totals.decided), percent(totals.decided, totals.games)],
      ]} />
      {summary.legends[0] && <TopPick label="Most picked" image={legendArt(summary.legends[0].name)} name={legendName(summary.legends[0].name)} detail={plural(summary.legends[0].games, "pick")} />}
      {summary.maps[0] && <TopPick label="Most played" image={mapArt(summary.maps[0].name)} wide name={mapName(summary.maps[0].name)} detail={plural(summary.maps[0].games, "game")} />}
    </div>
  );
}

export function Panel({ title, count, action, children, className = "" }) {
  return (
    <Card padded={false} className={className} title={<span>{title}{count != null && <span className="ml-2 text-sm font-normal text-slate-400">{count}</span>}</span>} action={action}>
      <div className="p-2">{children}</div>
    </Card>
  );
}

function ViewSwitch({ value, onChange, options }) {
  return (
    <div className="flex overflow-hidden rounded-md border text-xs font-black border-slate-700">
      {options.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)} className={`px-2 py-1 transition ${value === key ? "bg-blue-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{label}</button>
      ))}
    </div>
  );
}

function LegendTable({ rows, total, legendName, onPick, active, mapsFor, showPlayers = false, showShare = true, step = 12 }) {
  const [limit, setLimit] = useState(step);
  if (!rows.length) return <Empty bare>No legends reported</Empty>;
  const showTop = rows.some((row) => row.topPlayer);
  return (
    <div className="grid gap-1">
      <ScrollX>
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
              <th className="px-2 py-1.5">Legend</th>
              <th className="px-2 py-1.5 text-right">Picks</th>
              {showShare && <th className="px-2 py-1.5 text-right" title="Share of games with this legend in them">Games</th>}
              {showPlayers && <th className="px-2 py-1.5 text-right">Players</th>}
              <th className="w-48 px-2 py-1.5">Record</th>
              {mapsFor && <th className="hidden px-2 py-1.5 lg:table-cell">Top maps</th>}
              {showTop && <th className="hidden px-2 py-1.5 xl:table-cell">Most played by</th>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => (
              <tr
                key={row.key}
                onClick={onPick ? () => onPick(row.key) : undefined}
                className={`border-t border-slate-800 ${onPick ? "cursor-pointer hover:bg-slate-800/50" : ""} ${active === row.key ? "bg-blue-500/15" : ""}`}
              >
                <td className="px-2 py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <Face legend={row.name} legendName={legendName} />
                    <span className="truncate font-black text-white">{legendName(row.name)}</span>
                  </span>
                </td>
                <td className="px-2 py-1 text-right font-bold tabular-nums text-slate-200">{number(row.games)}</td>
                {showShare && <td className="px-2 py-1 text-right font-semibold tabular-nums text-slate-400">{percent(row.gamesWith ?? row.games, total)}</td>}
                {showPlayers && <td className="px-2 py-1 text-right font-semibold tabular-nums text-slate-400">{row.players ? number(row.players) : "—"}</td>}
                <td className="px-2 py-1"><WinLine wins={row.wins} known={row.known} games={row.games} compact /></td>
                {mapsFor && (
                  <td className="hidden px-2 py-1 text-xs font-semibold text-slate-400 lg:table-cell">
                    <span className="line-clamp-1">{mapsFor(row.key).slice(0, 2).map((entry) => `${mapName(entry.name)} ${number(entry.count)}`).join(" · ")}</span>
                  </td>
                )}
                {showTop && (
                  <td className="hidden max-w-[12rem] truncate px-2 py-1 text-xs font-semibold text-slate-300 xl:table-cell">
                    {row.topPlayer ? <>{cleanEntrantName(row.topPlayer.name)} <span className="tabular-nums text-slate-500">{number(row.topPlayer.count)}</span></> : ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      <MoreToggle total={rows.length} limit={limit} step={step} onChange={setLimit} />
    </div>
  );
}
function MatchupLine({ label, entry, legendName, tone }) {
  if (!entry) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <Face legend={entry.name} legendName={legendName} size="h-5 w-5" />
        <span className="truncate text-slate-200">{legendName(entry.name)}</span>
        <span className={`shrink-0 tabular-nums ${tone}`}>{number(entry.wins)}–{number(entry.known - entry.wins)}</span>
      </span>
    </div>
  );
}

function LegendCards({ rows, total, legendName, onPick, active, matchups, minGames, step = 12 }) {
  const [limit, setLimit] = useState(step);
  if (!rows.length) return <Empty bare>No legends reported</Empty>;
  return (
    <div className="grid gap-2">
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-2">
      {rows.slice(0, limit).map((row) => {
        const rated = (matchups.get(row.key) ?? []).filter((entry) => entry.known >= minGames)
          .sort((left, right) => rateOf(right) - rateOf(left) || right.known - left.known);
        const best = rated[0];
        const worst = rated.length > 1 ? rated[rated.length - 1] : null;
        const rate = rateOf(row);
        return (
          <button key={row.key} type="button" onClick={() => onPick(row.key)} className={`grid gap-1.5 rounded-lg p-2 text-left text-xs font-bold transition bg-slate-950/60 ${active === row.key ? "ring-2 ring-blue-400" : "hover:bg-slate-800/60"}`}>
            <span className="flex items-center gap-2">
              <Face legend={row.name} legendName={legendName} size="h-11 w-11" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-white">{legendName(row.name)}</span>
                <span className="block font-semibold text-slate-400">{plural(row.games, "pick")} · {percent(row.gamesWith ?? row.games, total)} of games</span>
              </span>
              {rate != null && <span className={`text-lg font-black tabular-nums ${rate >= 0.5 ? "text-sky-400" : "text-rose-400"}`}>{Math.round(rate * 100)}%</span>}
            </span>
            <MatchupLine label="Best vs" entry={best} legendName={legendName} tone="text-sky-400" />
            <MatchupLine label="Worst vs" entry={worst} legendName={legendName} tone="text-rose-400" />
            {row.topPlayer && (
              <span className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Most played by</span>
                <span className="truncate text-slate-200">{row.topPlayer.name} <span className="tabular-nums text-slate-500">{number(row.topPlayer.count)}</span></span>
              </span>
            )}
          </button>
        );
      })}
    </div>
    <MoreToggle total={rows.length} limit={limit} step={step} onChange={setLimit} />
    </div>
  );
}

function MetaChart({ rows, total, legendName, onPick, active, minGames }) {
  const clip = useId().replace(/[^a-zA-Z0-9]/g, "");
  const points = rows.filter((row) => row.known >= minGames).slice(0, 40);
  if (points.length < 2) return <Empty bare>Not enough results to chart yet</Empty>;
  const width = 1000;
  const height = 380;
  const pad = { left: 44, right: 20, top: 16, bottom: 36 };
  const share = (row) => (total ? (row.gamesWith ?? row.games) / total : 0);
  const maxShare = Math.max(...points.map(share)) * 1.08 || 1;
  const rates = points.map(rateOf);
  const low = Math.max(0, Math.floor((Math.min(...rates, 0.5) - 0.05) * 10) / 10);
  const high = Math.min(1, Math.ceil((Math.max(...rates, 0.5) + 0.05) * 10) / 10);
  const x = (value) => pad.left + (value / maxShare) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (1 - (value - low) / (high - low || 1)) * (height - pad.top - pad.bottom);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => step * maxShare);
  const yTicks = [];
  for (let value = low; value <= high + 1e-9; value += 0.1) yTicks.push(Math.round(value * 10) / 10);
  const size = 30;
  return (
    <div className="grid gap-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-6xl" role="img" aria-label="Legends by share of games and win rate">
        <defs><clipPath id={clip} clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath></defs>
        {yTicks.map((value) => (
          <g key={`y${value}`}>
            <line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} stroke={value === 0.5 ? "#64748b" : "#1e293b"} strokeDasharray={value === 0.5 ? "4 4" : undefined} />
            <text x={pad.left - 6} y={y(value) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{Math.round(value * 100)}%</text>
          </g>
        ))}
        {xTicks.map((value) => (
          <text key={`x${value}`} x={x(value)} y={height - pad.bottom + 16} textAnchor="middle" fontSize="11" fill="#94a3b8">{Math.round(value * 100)}%</text>
        ))}
        <text x={(width + pad.left) / 2} y={height - 4} textAnchor="middle" fontSize="11" fill="#64748b">Share of games</text>
        <text x={12} y={(height - pad.bottom) / 2} textAnchor="middle" fontSize="11" fill="#64748b" transform={`rotate(-90 12 ${(height - pad.bottom) / 2})`}>Win rate</text>
        {points.map((row) => {
          const cx = x(share(row));
          const cy = y(rateOf(row));
          const chosen = active === row.key;
          return (
            <g key={row.key} onClick={() => onPick(row.key)} className="cursor-pointer">
              <title>{`${legendName(row.name)}: ${Math.round(share(row) * 100)}% of games, ${Math.round(rateOf(row) * 100)}% wins (${number(row.wins)}–${number(row.known - row.wins)})`}</title>
              <circle cx={cx} cy={cy} r={size / 2 + 2} fill="#0f172a" stroke={chosen ? "#60a5fa" : rateOf(row) >= 0.5 ? "#38bdf8" : "#fb7185"} strokeWidth={chosen ? 3 : 2} />
              <image href={legendArt(row.name)} x={cx - size / 2} y={cy - size / 2} width={size} height={size} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
            </g>
          );
        })}
      </svg>
      <div className="text-[11px] font-semibold text-slate-500">Legends with at least {plural(minGames, "game")} with a known result. Blue ring: wins more than it loses.</div>
    </div>
  );
}

export function LegendSection({ summary, legendName, onPick, active, minGames = 3 }) {
  const [view, setView] = useState("table");
  const mapNames = useMemo(() => new Map(summary.maps.map((row) => [row.key, row.name])), [summary.maps]);
  const mapsByLegend = useMemo(() => {
    const index = new Map();
    for (const entry of summary.legendMaps) {
      if (!index.has(entry.legend)) index.set(entry.legend, []);
      index.get(entry.legend).push({ key: entry.map, name: mapNames.get(entry.map) ?? entry.map, count: entry.count });
    }
    for (const list of index.values()) list.sort((left, right) => right.count - left.count);
    return index;
  }, [summary.legendMaps, mapNames]);
  const matchups = useMemo(() => matchupIndex(summary.pairs), [summary.pairs]);
  return (
    <Panel
      title="Legends"
      count={plural(summary.totals.legends, "legend")}
      action={<ViewSwitch value={view} onChange={setView} options={[["table", "Table"], ["cards", "Cards"], ["chart", "Meta chart"]]} />}
    >
      {view === "table" && <LegendTable rows={summary.legends} total={summary.totals.games} legendName={legendName} onPick={onPick} active={active} mapsFor={(key) => mapsByLegend.get(key) ?? []} showPlayers />}
      {view === "cards" && <LegendCards rows={summary.legends} total={summary.totals.games} legendName={legendName} onPick={onPick} active={active} matchups={matchups} minGames={minGames} />}
      {view === "chart" && <MetaChart rows={summary.legends} total={summary.totals.games} legendName={legendName} onPick={onPick} active={active} minGames={minGames} />}
    </Panel>
  );
}

export function weaponRows(legendRows, weaponsOf) {
  const byWeapon = new Map();
  let picks = 0;
  for (const row of legendRows ?? []) {
    const pair = weaponsOf(row.key ?? row.name);
    if (!pair) continue;
    picks += row.games;
    for (const weapon of pair) {
      const entry = byWeapon.get(weapon) ?? { key: weapon, games: 0, wins: 0, known: 0, legends: [] };
      entry.games += row.games;
      entry.wins += row.wins;
      entry.known += row.known;
      entry.legends.push(row);
      byWeapon.set(weapon, entry);
    }
  }
  const list = [...byWeapon.values()].map((entry) => ({ ...entry, legends: [...entry.legends].sort(byGames) }));
  return { picks, list };
}

function WeaponList({ rows, picks, legendName, onPickLegend, activeLegend, minGames }) {
  const [sort, setSort] = useState("picks");
  const sorted = useMemo(() => {
    const list = [...rows];
    if (sort === "rate") {
      return list.sort((left, right) => (right.known >= minGames) - (left.known >= minGames) || (rateOf(right) ?? -1) - (rateOf(left) ?? -1) || right.games - left.games);
    }
    return list.sort(byGames);
  }, [rows, sort, minGames]);
  const top = Math.max(1, ...rows.map((row) => row.games));
  if (!rows.length) return <Empty bare>No legend picks reported</Empty>;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span title="Each pick counts for both of the legend's weapons">A pick counts for both of the legend's weapons.</span>
        <ViewSwitch value={sort} onChange={setSort} options={[["picks", "Most picked"], ["rate", "Win %"]]} />
      </div>
      <div className="grid gap-1">
        {sorted.map((row) => (
          <div key={row.key} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-lg px-1 py-1.5 hover:bg-slate-800/50 sm:grid-cols-[2rem_9rem_minmax(0,1fr)_9rem]">
            <img src={weaponIconUrl(row.key)} alt="" loading="lazy" onError={hide} className="h-8 w-8 object-contain" />
            <span className="min-w-0">
              <a href={`/game/weapons?weapon=${encodeURIComponent(weaponName(row.key).replace(/\s+/g, ""))}`} className="block truncate font-bold text-white hover:text-blue-300">{weaponName(row.key)}</a>
              <span className="block text-xs tabular-nums text-slate-400">{plural(row.games, "pick")}</span>
            </span>
            <span className="col-start-2 grid gap-0.5 sm:col-start-auto" title={`${number(row.games)} of ${number(picks)} picks`}>
              <span className="text-[11px] font-bold tabular-nums text-slate-400">{percent(row.games, picks)} of picks</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-blue-400/80" style={{ width: `${Math.max(2, (100 * row.games) / top)}%` }} /></span>
            </span>
            <span className="col-start-2 sm:col-start-auto"><WinLine wins={row.wins} known={row.known} games={row.games} /></span>
            <span className="col-start-2 flex flex-wrap gap-1 sm:col-span-3">
              {row.legends.slice(0, 10).map((legend) => (
                <button
                  key={legend.key}
                  type="button"
                  onClick={() => onPickLegend?.(legend.key)}
                  disabled={!onPickLegend}
                  title={`${legendName(legend.key)}: ${plural(legend.games, "pick")}`}
                  className={`rounded-md ${activeLegend === legend.key ? "ring-2 ring-blue-400" : onPickLegend ? "hover:ring-1 hover:ring-slate-500" : ""}`}
                >
                  <Face legend={legend.key} legendName={legendName} size="h-7 w-7" title={`${legendName(legend.key)}: ${plural(legend.games, "pick")}`} />
                </button>
              ))}
              {row.legends.length > 10 && <span className="self-center text-xs text-slate-500">+{row.legends.length - 10}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeaponSection({ title = "Weapons", legendRows, againstRows, weaponsOf, legendName, onPickLegend, activeLegend, minGames = 3, className = "" }) {
  const [side, setSide] = useState("used");
  const used = useMemo(() => weaponRows(legendRows, weaponsOf), [legendRows, weaponsOf]);
  const against = useMemo(() => weaponRows(againstRows, weaponsOf), [againstRows, weaponsOf]);
  const shown = againstRows && side === "against" ? against : used;
  return (
    <Panel
      title={title}
      count={plural(shown.list.length, "weapon")}
      className={className}
      action={againstRows ? <ViewSwitch value={side} onChange={setSide} options={[["used", "Picked"], ["against", "Faced"]]} /> : null}
    >
      <WeaponList rows={shown.list} picks={shown.picks} legendName={legendName} onPickLegend={side === "used" ? onPickLegend : null} activeLegend={activeLegend} minGames={minGames} />
    </Panel>
  );
}

function MapGrid({ rows, total, legendName, onPick, active, focused, legendsFor, step = 10 }) {
  const [limit, setLimit] = useState(step);
  if (!rows.length) return <Empty bare>No maps reported</Empty>;
  return (
    <div className="grid gap-2">
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(13rem,100%),1fr))] gap-2">
      {rows.slice(0, limit).map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={() => onPick(row.key)}
          className={`relative h-24 overflow-hidden rounded-lg text-left transition bg-slate-800 ${active === row.key ? "ring-2 ring-blue-400" : "hover:ring-1 hover:ring-slate-500"}`}
        >
          <img src={mapArt(row.name)} alt="" loading="lazy" onError={hide} className="absolute inset-0 h-full w-full object-cover brightness-[0.4]" />
          <span className="relative flex h-full flex-col justify-between p-2 text-white">
            <span className="flex items-start justify-between gap-2">
              <span className="truncate font-black">{mapName(row.name)}</span>
              <span className="shrink-0 text-xs font-bold tabular-nums">{number(row.games)} · {percent(row.games, total)}</span>
            </span>
            <span className="flex items-end justify-between gap-2">
              <span className="flex -space-x-1.5">
                {(legendsFor?.(row.key) ?? []).slice(0, 4).map((entry) => <Face key={entry.key} legend={entry.name} legendName={legendName} size="h-7 w-7" title={`${legendName(entry.name)} · ${number(entry.count)}`} />)}
              </span>
              {focused && <WinLine wins={row.wins} known={row.known} games={row.games} compact />}
            </span>
          </span>
        </button>
      ))}
    </div>
    <MoreToggle total={rows.length} limit={limit} step={step} onChange={setLimit} />
    </div>
  );
}

function MapsByGame({ summary, onPick, active }) {
  const names = new Map(summary.maps.map((row) => [row.key, row.name]));
  const totals = new Map();
  for (const entry of summary.byGame) totals.set(entry.map, (totals.get(entry.map) ?? 0) + entry.count);
  const shown = [...totals.entries()].sort((left, right) => right[1] - left[1]).slice(0, PALETTE.length - 1).map(([key]) => key);
  const color = (key) => (shown.includes(key) ? PALETTE[shown.indexOf(key)] : PALETTE[PALETTE.length - 1]);
  const rows = [1, 2, 3].map((slot) => {
    const entries = summary.byGame.filter((entry) => entry.game === slot);
    const sum = entries.reduce((total, entry) => total + entry.count, 0);
    const segments = shown.map((key) => ({ key, count: entries.find((entry) => entry.map === key)?.count ?? 0 })).filter((segment) => segment.count);
    const other = sum - segments.reduce((total, segment) => total + segment.count, 0);
    if (other > 0) segments.push({ key: "", count: other });
    return { slot, sum, segments };
  }).filter((row) => row.sum);
  if (!rows.length) return <Empty bare>No maps reported</Empty>;
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.slot} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-2">
          <span className="text-xs font-black text-slate-300">{row.slot === 3 ? "Game 3+" : `Game ${row.slot}`}</span>
          <span className="flex h-7 overflow-hidden rounded-md bg-slate-800">
            {row.segments.map((segment) => {
              const share = segment.count / row.sum;
              return (
                <button
                  key={segment.key || "other"}
                  type="button"
                  onClick={segment.key ? () => onPick(segment.key) : undefined}
                  title={`${segment.key ? mapName(names.get(segment.key)) : "Other maps"}: ${number(segment.count)} (${Math.round(share * 100)}%)`}
                  className={`h-full border-r-2 border-slate-900 text-[10px] font-black text-white last:border-r-0 ${active && active !== segment.key ? "opacity-40" : ""}`}
                  style={{ width: `${share * 100}%`, background: segment.key ? color(segment.key) : PALETTE[PALETTE.length - 1] }}
                >
                  {share >= 0.09 ? `${Math.round(share * 100)}%` : ""}
                </button>
              );
            })}
          </span>
          <span className="text-right text-xs font-bold tabular-nums text-slate-400">{number(row.sum)}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs font-semibold text-slate-300">
        {shown.map((key) => (
          <button key={key} type="button" onClick={() => onPick(key)} className="flex items-center gap-1.5 hover:text-white">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(key) }} />
            {mapName(names.get(key))}
          </button>
        ))}
        {totals.size > shown.length && <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[PALETTE.length - 1] }} />Other</span>}
      </div>
    </div>
  );
}

function MapHeatmap({ summary, legendName, onPickLegend, onPickMap, activeLegend, activeMap, step = 12 }) {
  const [limit, setLimit] = useState(step);
  const legends = summary.legends.slice(0, limit);
  const maps = summary.maps.slice(0, 10);
  const cells = new Map(summary.legendMaps.map((entry) => [`${entry.legend}|${entry.map}`, entry.count]));
  const max = Math.max(1, ...legends.flatMap((legend) => maps.map((map) => cells.get(`${legend.key}|${map.key}`) ?? 0)));
  if (!legends.length || !maps.length) return <Empty bare>No maps reported</Empty>;
  return (
    <div className="grid gap-1">
    <ScrollX>
      <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0.5 text-xs">
        <colgroup><col className="w-36" />{maps.map((map) => <col key={map.key} />)}</colgroup>
        <thead>
          <tr>
            <th />
            {maps.map((map) => (
              <th key={map.key} className="px-1 pb-1 align-bottom">
                <button type="button" onClick={() => onPickMap(map.key)} className={`block w-full truncate text-[10px] font-black uppercase leading-tight ${activeMap === map.key ? "text-blue-300" : "text-slate-400 hover:text-white"}`} title={mapName(map.name)}>{mapName(map.name)}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {legends.map((legend) => (
            <tr key={legend.key}>
              <th className="pr-1 text-left">
                <button type="button" onClick={() => onPickLegend(legend.key)} className={`flex items-center gap-1.5 font-black ${activeLegend === legend.key ? "text-blue-300" : "text-slate-200 hover:text-white"}`}>
                  <Face legend={legend.name} legendName={legendName} size="h-6 w-6" />
                  <span className="max-w-[6rem] truncate">{legendName(legend.name)}</span>
                </button>
              </th>
              {maps.map((map) => {
                const value = cells.get(`${legend.key}|${map.key}`) ?? 0;
                const strength = Math.sqrt(value / max);
                return (
                  <td key={map.key} className="p-0">
                    <button
                      type="button"
                      onClick={() => { onPickLegend(legend.key); onPickMap(map.key); }}
                      title={`${legendName(legend.name)} on ${mapName(map.name)}: ${plural(value, "pick")}`}
                      className="block h-7 w-full rounded text-center font-bold tabular-nums"
                      style={{ background: value ? `rgba(59,130,246,${(0.12 + strength * 0.88).toFixed(2)})` : "rgba(30,41,59,0.6)", color: strength > 0.45 ? "#fff" : "#cbd5e1" }}
                    >
                      {value ? number(value) : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
    <MoreToggle total={summary.legends.length} limit={limit} step={step} onChange={setLimit} />
    </div>
  );
}

export function MapSection({ summary, legendName, onPickMap, onPickLegend, activeMap, activeLegend }) {
  const [view, setView] = useState("tiles");
  const legendsByMap = useMemo(() => {
    const names = new Map(summary.legends.map((row) => [row.key, row.name]));
    const index = new Map();
    for (const entry of summary.legendMaps) {
      if (!index.has(entry.map)) index.set(entry.map, []);
      index.get(entry.map).push({ key: entry.legend, name: names.get(entry.legend) ?? entry.legend, count: entry.count });
    }
    for (const list of index.values()) list.sort((left, right) => right.count - left.count);
    return index;
  }, [summary.legendMaps, summary.legends]);
  return (
    <Panel
      title="Maps"
      count={plural(summary.totals.withMap, "game")}
      action={<ViewSwitch value={view} onChange={setView} options={[["tiles", "Tiles"], ["games", "By game"], ["heatmap", "Heatmap"]]} />}
    >
      {view === "tiles" && <MapGrid rows={summary.maps} total={summary.totals.withMap} legendName={legendName} onPick={onPickMap} active={activeMap} legendsFor={(key) => legendsByMap.get(key) ?? []} />}
      {view === "games" && <MapsByGame summary={summary} onPick={onPickMap} active={activeMap} />}
      {view === "heatmap" && <MapHeatmap summary={summary} legendName={legendName} onPickLegend={onPickLegend} onPickMap={onPickMap} activeLegend={activeLegend} activeMap={activeMap} />}
    </Panel>
  );
}

export function PairList({ rows, legendName, step = 16 }) {
  const [showMirrors, setShowMirrors] = useState(false);
  const [limit, setLimit] = useState(step);
  const list = rows.filter((row) => showMirrors || row.a !== row.b);
  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <input type="checkbox" checked={showMirrors} onChange={(event) => setShowMirrors(event.target.checked)} />
        Show mirror matches
      </label>
      {!list.length && <Empty bare>No matchups reported</Empty>}
      <div className="grid gap-1">
        {list.slice(0, limit).map((row) => (
          <div key={`${row.a}|${row.b}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1 bg-slate-950/60">
            <span className="flex min-w-0 items-center gap-2">
              <Face legend={row.aName} legendName={legendName} size="h-7 w-7" />
              <span className="truncate text-sm font-black text-white">{legendName(row.aName)}</span>
            </span>
            <span className="grid justify-items-center text-xs font-bold tabular-nums">
              {row.a === row.b ? <span className="text-slate-400">mirror · {number(row.games)}</span> : (
                <>
                  <span><span className="text-sky-400">{number(row.wins)}</span><span className="text-slate-500"> – </span><span className="text-rose-400">{number(row.known - row.wins)}</span></span>
                  <span className="text-[10px] text-slate-500">{plural(row.games, "game")}</span>
                </>
              )}
            </span>
            <span className="flex min-w-0 flex-row-reverse items-center gap-2">
              <Face legend={row.bName} legendName={legendName} size="h-7 w-7" />
              <span className="truncate text-right text-sm font-black text-white">{legendName(row.bName)}</span>
            </span>
          </div>
        ))}
      </div>
      <MoreToggle total={Math.min(list.length, 300)} limit={limit} step={step} onChange={setLimit} />
    </div>
  );
}

export function PlayerTable({ rows, legendName, onPick, active, placeholder = "Find a player or team", step = 15 }) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(step);
  const term = search.trim().toLowerCase();
  const list = rows.filter((row) => !term || String(row.name).toLowerCase().includes(term));
  const placed = rows.some((row) => row.placement != null);
  return (
    <div className="grid gap-2">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-2 py-1.5 text-sm border-slate-700 bg-slate-950 text-white sm:max-w-xs"
      />
      {!list.length && <Empty bare>No players found</Empty>}
      <ScrollX>
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
              <th className="px-2 py-1.5">Player</th>
              {placed && <th className="px-2 py-1.5 text-right">Place</th>}
              <th className="px-2 py-1.5 text-right">Games</th>
              <th className="px-2 py-1.5">Record</th>
              <th className="px-2 py-1.5">Legends</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map((row) => (
              <tr key={row.key} onClick={() => onPick(row.key)} className={`cursor-pointer border-t border-slate-800 hover:bg-slate-800/50 ${active === row.key ? "bg-blue-500/15" : ""}`}>
                <td className="max-w-[14rem] truncate px-2 py-1 font-black text-white">{cleanEntrantName(row.name)}</td>
                {placed && <td className="px-2 py-1 text-right font-semibold tabular-nums text-slate-400">{row.placement ?? "—"}</td>}
                <td className="px-2 py-1 text-right font-bold tabular-nums text-slate-200">{number(row.games)}</td>
                <td className="px-2 py-1"><WinLine wins={row.wins} known={row.known} games={row.games} compact /></td>
                <td className="px-2 py-1">
                  <span className="flex flex-wrap items-center gap-1">
                    {row.legends.slice(0, 5).map((entry) => (
                      <span key={entry.key} className="flex items-center gap-1 rounded-md pr-1.5 text-[11px] font-bold tabular-nums bg-slate-800 text-slate-300">
                        <Face legend={entry.name} legendName={legendName} size="h-6 w-6" title={`${legendName(entry.name)} · ${number(entry.count)}`} />
                        {number(entry.count)}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      <MoreToggle total={list.length} limit={limit} step={step} onChange={setLimit} />
    </div>
  );
}

export function FocusPanels({ focus, label, kind, legendName, onPickLegend, onPickMap, activeLegend, activeMap }) {
  if (!focus) return null;
  const count = `${plural(focus.games, "game")}${kind === "legend" && focus.mirrors ? ` · ${plural(focus.mirrors, "mirror")}` : ""}`;
  return (
    <div className="grid gap-3 2xl:grid-cols-2">
      {kind === "player" && (
        <Panel title={`${label}'s legends`} count={count}>
          <LegendTable rows={focus.legends} total={focus.games} legendName={legendName} onPick={onPickLegend} active={activeLegend} />
        </Panel>
      )}
      <Panel title={`Against ${label}`} count="opponent legends, record from this side">
        <LegendTable rows={focus.against} total={focus.games} legendName={legendName} showShare={false} />
      </Panel>
      <Panel title={`${label} by map`} count={kind === "legend" ? count : null} className={kind === "player" ? "2xl:col-span-2" : ""}>
        <MapGrid rows={focus.maps} total={focus.games} legendName={legendName} onPick={onPickMap} active={activeMap} focused />
      </Panel>
    </div>
  );
}

const setTime = (set) => new Date(set.history_at ?? set.completed_at ?? set.observed_at ?? 0).getTime() || 0;

const roundRank = (name) => {
  const round = String(name ?? "").toLowerCase();
  if (/grand final/.test(round)) return /reset/.test(round) ? 1000 : 990;
  if (/semi/.test(round)) return 800;
  if (/quarter/.test(round)) return 700;
  if (/final/.test(round)) return /lower|losers/.test(round) ? 890 : 900;
  const found = round.match(/round\s*(\d+)/);
  return found ? 100 + Number(found[1]) : 0;
};

function groupSets(games, order) {
  const groups = new Map();
  for (const game of games) {
    if (!groups.has(game.set.id)) groups.set(game.set.id, { set: game.set, names: game.names, games: [] });
    groups.get(game.set.id).games.push(game);
  }
  const byTime = (left, right) => setTime(right.set) - setTime(left.set) || (right.set.set_order ?? 0) - (left.set.set_order ?? 0);
  const sorters = {
    bracket: (left, right) => roundRank(right.set.round_name) - roundRank(left.set.round_name) || byTime(left, right),
    recent: byTime,
    games: (left, right) => right.games.length - left.games.length || byTime(left, right),
  };
  return [...groups.values()].sort(sorters[order] ?? sorters.bracket);
}

function GameRow({ game, legendName }) {
  const side = (index) => {
    const won = game.winner === index;
    const lost = game.winner >= 0 && !won;
    return (
      <span className={"flex min-w-0 items-center gap-1 " + (index ? "flex-row-reverse" : "")}>
        <span className={"w-3 shrink-0 text-center text-[11px] font-black " + (won ? "text-emerald-400" : lost ? "text-rose-400/70" : "text-transparent")}>{won ? "W" : lost ? "L" : "·"}</span>
        {game.sides[index].length > 1 && game.sides[index].every((pick) => pick.playerName)
          ? (
            <span className={"grid min-w-0 gap-0.5 " + (index ? "justify-items-end" : "")}>
              {[...game.sides[index]].sort((left, right) => String(left.playerName).localeCompare(String(right.playerName))).map((pick, position) => (
                <span key={pick.key + ":" + position} className={"flex min-w-0 max-w-full items-center gap-1.5 " + (index ? "flex-row-reverse" : "")}>
                  <Face legend={pick.legend} legendName={legendName} size="h-7 w-7" dim={lost} title={legendName(pick.legend) + " · " + pick.playerName} />
                  <span className={"min-w-0 truncate text-[11px] font-bold " + (lost ? "text-slate-500" : "text-slate-300")}>{pick.playerName}</span>
                </span>
              ))}
            </span>
          )
          : game.sides[index].length
          ? game.sides[index].map((pick, position) => (
            <Face
              key={pick.key + ":" + position}
              legend={pick.legend}
              legendName={legendName}
              size="h-9 w-9"
              dim={lost}
              title={pick.playerName ? legendName(pick.legend) + " · " + pick.playerName : undefined}
            />
          ))
          : <span className="h-9 w-9 shrink-0 rounded-md border border-dashed border-slate-700" title="No legend reported" />}
        {game.sides[index].length === 1 && (
          <span className={"hidden min-w-0 truncate text-xs font-bold min-[30rem]:block " + (index ? "text-right " : "") + (lost ? "text-slate-500" : "text-slate-200")}>{legendName(game.sides[index][0].legend)}</span>
        )}
      </span>
    );
  };
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)] items-center gap-1.5 border-t px-2 py-1 border-slate-800/70">
      <span className="text-[11px] font-black tabular-nums text-slate-500">G{game.number}</span>
      {side(0)}
      <span className="relative h-9 overflow-hidden rounded-md bg-slate-800" title={game.map ? mapName(game.map) : "No map reported"}>
        {game.map && <img src={mapArt(game.map)} alt="" loading="lazy" onError={hide} className="absolute inset-0 h-full w-full object-cover brightness-50" />}
        <span className="relative flex h-full items-center justify-center px-1 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-white">
          {game.map ? mapName(game.map) : <span className="text-slate-500">No map</span>}
        </span>
      </span>
      {side(1)}
    </div>
  );
}

export function SetGames({ group, legendName, context }) {
  const slots = group.set.slots ?? [];
  const decided = slots.some((slot) => slot.winner);
  const name = (index) => {
    const slot = slots[index];
    return (
      <span className={"min-w-0 truncate text-sm " + (index ? "text-right " : "") + (slot?.winner ? "font-black text-white" : decided ? "font-semibold text-slate-500" : "font-semibold text-slate-200")}>
        {cleanEntrantName(group.names[index])}
      </span>
    );
  };
  const score = (index) => {
    const value = slots[index]?.score;
    return value == null ? (decided ? (slots[index]?.winner ? "W" : "L") : "–") : value < 0 ? "DQ" : value;
  };
  return (
    <a href={"/esports/set/" + group.set.id} className="block overflow-hidden rounded-lg border transition border-slate-800 bg-slate-950/60 hover:border-blue-400/60">
      {context && <div className="truncate px-2 pt-1.5 text-[11px] font-bold text-slate-400">{context}</div>}
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
        <span className="truncate">{group.set.round_name ?? "Match"}</span>
        <span className="shrink-0">{plural(group.games.length, "game")}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 pb-1.5 pt-0.5">
        {name(0)}
        <span className="flex items-center gap-1.5 text-base font-black tabular-nums">
          <span className={slots[0]?.winner ? "text-white" : "text-slate-500"}>{score(0)}</span>
          <span className="text-slate-600">–</span>
          <span className={slots[1]?.winner ? "text-white" : "text-slate-500"}>{score(1)}</span>
        </span>
        {name(1)}
      </div>
      {group.games.map((game) => <GameRow key={game.id} game={game} legendName={legendName} />)}
    </a>
  );
}

export const SET_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(24rem,100%),1fr))] items-start gap-2";

function GameList({ games, legendName }) {
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState("bracket");
  const groups = useMemo(() => groupSets(games, order), [games, order]);
  const perPage = 24;
  const pages = Math.ceil(groups.length / perPage);
  const current = Math.min(page, Math.max(1, pages));
  if (!groups.length) return <Empty bare>No games match these filters</Empty>;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1">
        {[["bracket", "Finals first"], ["recent", "Most recent"], ["games", "Longest sets"]].map(([key, label]) => (
          <button key={key} type="button" onClick={() => { setOrder(key); setPage(1); }} className={"rounded-md px-2 py-1 text-xs font-black transition " + (order === key ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>{label}</button>
        ))}
      </div>
      <div className={SET_GRID}>
        {groups.slice((current - 1) * perPage, current * perPage).map((group) => <SetGames key={group.set.id} group={group} legendName={legendName} />)}
      </div>
      <Pagination page={current} totalPages={pages} onChange={setPage} />
    </div>
  );
}

export function MatchData({ sets = [], entrants = [] }) {
  const legendName = useLegendNames();
  const weaponsOf = useLegendWeapons();
  const [legend, setLegend] = useQueryState("legend", "");
  const [map, setMap] = useQueryState("map", "");
  const [player, setPlayer] = useQueryState("player", "");
  const [round, setRound] = useQueryState("round", "");
  const all = useMemo(() => collectGames(sets, entrants), [sets, entrants]);
  const rounds = useMemo(() => [...new Set(all.map((game) => game.set.round_name).filter(Boolean))], [all]);
  const options = useMemo(() => {
    const legends = new Map();
    const maps = new Map();
    const players = new Map();
    for (const game of all) {
      for (const side of game.sides) for (const pick of side) legends.set(pick.key, pick.legend);
      if (game.map) maps.set(game.mapKey, game.map);
      game.entrantIds.forEach((id, side) => players.set(id, game.names[side]));
    }
    const sorted = (entries, label) => [...entries].map(([key, name]) => [key, label(name)]).sort((left, right) => left[1].localeCompare(right[1]));
    return { legends: sorted(legends, legendName), maps: sorted(maps, mapName), players: sorted(players, String) };
  }, [all, legendName]);

  const games = useMemo(() => all.filter((game) => {
    if (round && game.set.round_name !== round) return false;
    if (map && game.mapKey !== map) return false;
    const side = player ? game.entrantIds.indexOf(player) : -1;
    if (player && side < 0) return false;
    if (legend) {
      const sides = side >= 0 ? [game.sides[side]] : game.sides;
      if (!sides.some((picks) => picks.some((pick) => pick.key === legend))) return false;
    }
    return true;
  }), [all, round, map, player, legend]);

  const focus = useMemo(() => {
    if (player) return buildFocus(games, (game) => game.entrantIds.indexOf(player));
    if (legend) {
      return buildFocus(games, (game) => {
        const has = game.sides.map((picks) => picks.some((pick) => pick.key === legend));
        return has[0] === has[1] ? -1 : has.indexOf(true);
      });
    }
    return null;
  }, [games, player, legend]);

  const summary = useMemo(() => buildSummary(games), [games]);
  const people = useMemo(() => entrantRows(games, entrants), [games, entrants]);

  const totalSets = sets.filter((set) => (set.slots ?? []).length === 2 && (set.state === "complete" || (set.slots ?? []).some((slot) => slot.winner))).length;
  const dataSets = new Set(all.map((game) => game.set.id)).size;
  const toggle = (setter, current) => (value) => setter(current === value ? "" : value);
  const filtered = Boolean(legend || map || player || round);
  const playerName = options.players.find(([key]) => key === player)?.[1];
  const focusLabel = player ? playerName : legend ? legendName(options.legends.find(([key]) => key === legend)?.[1] ?? legend) : null;

  if (!all.length) {
    return <Card><Empty>No legends or maps were reported for this event.</Empty></Card>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <Panel title="Filters" action={filtered && (
          <button type="button" onClick={() => { setLegend(""); setMap(""); setPlayer(""); setRound(""); }} className="text-xs font-bold text-blue-300 hover:text-blue-200">Clear</button>
        )}>
          <div className="grid gap-2">
            <Select label="Player" value={player} onChange={setPlayer} options={[["", "Everyone"], ...options.players]} />
            <Select label="Legend" value={legend} onChange={setLegend} options={[["", "Any legend"], ...options.legends]} />
            <Select label="Map" value={map} onChange={setMap} options={[["", "Any map"], ...options.maps]} />
            {rounds.length > 1 && <Select label="Round" value={round} onChange={setRound} options={[["", "All rounds"], ...rounds.map((name) => [name, name])]} />}
          </div>
        </Panel>
        <Panel title="Reported">
          <ReportedFacts
            summary={{ ...summary, totals: { ...summary.totals, gamesOf: filtered ? all.length : null } }}
            legendName={legendName}
            coverage={filtered
              ? <Coverage value={summary.totals.sets} total={dataSets} label="sets with data match these filters" />
              : <Coverage value={dataSets} total={totalSets} label="played sets have game data" />}
          />
        </Panel>
      </aside>

      <div className="grid min-w-0 content-start gap-3">
        <FocusPanels focus={focus} label={focusLabel} kind={player ? "player" : "legend"} legendName={legendName} onPickLegend={toggle(setLegend, legend)} onPickMap={toggle(setMap, map)} activeLegend={legend} activeMap={map} />

        {focus && player && (
          <WeaponSection title={`${focusLabel}'s weapons`} legendRows={focus.legends} againstRows={focus.against} weaponsOf={weaponsOf} legendName={legendName} onPickLegend={toggle(setLegend, legend)} activeLegend={legend} />
        )}
        {focus && !player && legend && (
          <WeaponSection title={`Weapons against ${focusLabel}`} legendRows={focus.against} weaponsOf={weaponsOf} legendName={legendName} />
        )}
        <LegendSection summary={summary} legendName={legendName} onPick={toggle(setLegend, legend)} active={legend} />
        <WeaponSection legendRows={summary.legends} weaponsOf={weaponsOf} legendName={legendName} onPickLegend={toggle(setLegend, legend)} activeLegend={legend} />
        <MapSection summary={summary} legendName={legendName} onPickMap={toggle(setMap, map)} onPickLegend={toggle(setLegend, legend)} activeMap={map} activeLegend={legend} />

        <div className="grid gap-3 2xl:grid-cols-2">
          <Panel title="Players" count={plural(people.length, "entrant")}>
            <PlayerTable rows={people} legendName={legendName} onPick={toggle(setPlayer, player)} active={player} />
          </Panel>
          <Panel title="Legend matchups" count={plural(summary.pairs.filter((row) => row.a !== row.b).length, "pairing")}>
            <PairList rows={summary.pairs} legendName={legendName} />
          </Panel>
        </div>

        <Panel title="Games" count={`${plural(summary.totals.games, "game")} in ${plural(summary.totals.sets, "set")}`}>
          <GameList games={games} legendName={legendName} />
        </Panel>
      </div>
    </div>
  );
}
