import React from "react";
import { host } from "../../stuff";
import {
  apiUrl, Avatar, Badge, Card, date, Empty, ErrorNote, LIVE_REFRESH_MS, LiveUpdates, Loading, modeName, PageShell, ProviderLink,
  useApi,
} from "./ui";

export const mapName = (value) => {
  const name = String(value ?? "").trim();
  if (!name) return "Unknown map";
  if (name.replace(/[^a-z]/gi, "").toLowerCase() === "fortressofthelions") return "Fortress of Lions";
  return name.replace(/^Small\s+/i, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
};

export const legendKey = (value) => String(value ?? "").normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase();

export function useLegendNames() {
  const legends = useApi(`${host}/game/legends/summary`);
  const names = new Map();
  for (const legend of Array.isArray(legends.data) ? legends.data : []) {
    const display = legend.bio?.name?.normal ?? legend.codeName;
    names.set(legendKey(legend.codeName), display);
    names.set(legendKey(display), display);
  }
  return (code) => names.get(legendKey(code)) ?? code ?? "Unknown";
}


export function SetPage({ setId }) {
  const detail = useApi(apiUrl(`/sets/${setId}`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: (data) => data?.set?.state === "active" });
  const legendName = useLegendNames();
  const data = detail.data;
  if (detail.error) return <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }}><ErrorNote message={detail.error} /></PageShell>;
  if (!data) return <PageShell><Loading label="Loading match..." /></PageShell>;
  const set = data.set;
  const slots = data.slots ?? [];
  const games = set.games ?? [];
  const sideOf = (accountId) => slots.findIndex((slot) => (slot.members ?? []).some((member) => member.gameAccountId === accountId));
  const picks = (game) => game.entrantSelections?.length
    ? game.entrantSelections.map((pick) => ({ key: `${pick.providerEntrantId}:${pick.legend}`, legend: pick.legend, side: slots.findIndex((slot) => String(slot.provider_entrant_id) === String(pick.providerEntrantId)) }))
    : (game.selections ?? []).map((pick) => ({ key: pick.gameAccountId ?? pick.name, legend: pick.legend, name: pick.name, side: sideOf(pick.gameAccountId) }));
  const scoreWinnerSide = (gameNumber) => {
    const scores = slots.map((slot) => slot?.score);
    if (scores.length !== 2 || !scores.every((score) => Number.isInteger(score) && score >= 0) || scores[0] === scores[1]) return -1;
    const total = scores[0] + scores[1];
    if (gameNumber < 1 || gameNumber > total) return -1;
    return Math.min(...scores) === 0 || gameNumber === total ? (scores[0] > scores[1] ? 0 : 1) : -1;
  };
  const winnerSide = (game) => (game.winnerProviderEntrantId == null
    ? scoreWinnerSide(Number(game.gameNumber))
    : slots.findIndex((slot) => String(slot.provider_entrant_id) === String(game.winnerProviderEntrantId)));

  return (
    <PageShell back={{ href: `/esports/event/${set.event_id}?view=matches`, label: set.event_name }}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-500">
          <span>{set.tournament_name} · {set.round_name} · {date(set.history_at ?? set.starts_at)}</span>
          <span className="flex items-center gap-2">
            {set.state === "active" && <LiveUpdates updatedAt={detail.updatedAt} />}
            {set.is_official && <Badge tone="blue">Official</Badge>}
            <Badge>{modeName(set.game_mode)}</Badge>
          </span>
        </div>
        {set.stream && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-800 dark:text-violet-200">
            <span aria-hidden="true">▶</span>
            {set.stream.url
              ? <a href={set.stream.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{set.state === "complete" ? "Streamed" : "On stream"}: {set.stream.name} ↗</a>
              : <span>{set.state === "complete" ? "Streamed" : "On stream"}: {set.stream.name}</span>}
          </div>
        )}
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          {[0, 1].map((index) => {
            const slot = slots[index];
            const side = (
              <div key={index} className={`flex min-w-0 flex-col gap-2 ${index ? "items-end text-right" : ""}`}>
                {(slot?.members?.length ? slot.members : [{ gamerTag: slot?.entrant_name }]).map((member) => (
                  <a key={member.identityId ?? member.gamerTag} href={member.playerId ? `/esports/player/id/${member.playerId}` : undefined} className={`flex min-w-0 items-center gap-3 ${index ? "flex-row-reverse" : ""} hover:opacity-80`}>
                    <Avatar src={member.image} name={member.gamerTag} playerId={member.playerId} />
                    <span className={`truncate text-lg font-black ${slot?.score > (slots[1 - index]?.score ?? -1) ? "text-slate-950 dark:text-white" : "text-slate-500"}`}>{member.gamerTag ?? "TBD"}</span>
                  </a>
                ))}
              </div>
            );
            return index === 0 ? side : [
              <div key="score" className="text-center text-4xl font-black tabular-nums text-slate-950 dark:text-white">
                {slots[0]?.score ?? "–"}<span className="mx-2 text-slate-400">:</span>{slots[1]?.score ?? "–"}
              </div>,
              side,
            ];
          })}
        </div>
        <div className="mt-4"><ProviderLink provider={set.provider} url={set.url} /></div>
      </section>

      <Card title="Games" className="mt-6" padded={false}>
        {!games.length && <Empty>Game-by-game details weren't reported for this match.</Empty>}
        {games.map((game) => (
          <div key={game.providerGameId ?? game.gameNumber} className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="flex items-center gap-3">
              <img src={`${host}/game/maps/thumbnail/${encodeURIComponent(game.map ?? "")}`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-12 w-20 rounded-md bg-slate-200 object-cover dark:bg-slate-800" />
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Game {game.gameNumber}</div>
                <div className="font-black text-slate-950 dark:text-white">{mapName(game.map)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((side) => (
                <div key={side} className={`flex flex-wrap items-center gap-2 ${side ? "flex-row-reverse" : ""}`}>
                  {winnerSide(game) >= 0 && (
                    <span className={`w-6 text-center font-mono text-lg font-black ${winnerSide(game) === side ? "text-emerald-500" : "text-rose-500"}`}>{winnerSide(game) === side ? "W" : "L"}</span>
                  )}
                  {picks(game).filter((pick) => pick.side === side).map((pick) => (
                    <span key={pick.key} className="flex items-center gap-2 rounded-lg bg-slate-100 py-1 pl-1 pr-2 text-sm font-bold dark:bg-slate-800">
                      <img src={`${host}/game/legends/art/${encodeURIComponent(pick.legend ?? "")}`} alt="" loading="lazy" className="h-7 w-7 rounded-md object-cover" />
                      <span className="text-slate-900 dark:text-white">{legendName(pick.legend)}</span>
                      {pick.name && <span className="text-xs text-slate-500">{pick.name}</span>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}
