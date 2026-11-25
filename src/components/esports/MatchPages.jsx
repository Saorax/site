import { host } from "../../stuff";
import {
  apiUrl, Avatar, Badge, Card, cleanEntrantName, date, Empty, ErrorNote, LIVE_REFRESH_MS, LiveUpdates, Loading, modeName, PageShell,
  ProviderLink, slotIsDq, useApi, vodTime, vodTitle, youtubeLabel, youtubeTitle,
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


const setIsLive = (data) => data?.set?.state === "active" && (data.set.event_display_state ?? "live") === "live";

export function SetPage({ setId, heading }) {
  const detail = useApi(apiUrl(`/sets/${setId}`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: setIsLive });
  const legendName = useLegendNames();
  const data = detail.data;
  if (detail.error) return <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }}><ErrorNote message={detail.error} onRetry={detail.retry} /></PageShell>;
  if (!data) return <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }} title={heading}><Loading label="Loading match…" /></PageShell>;
  const set = data.set;
  const slots = data.slots ?? [];
  const games = set.games ?? [];
  const winnerId = set.winner_entrant_id;
  const won = (slot) => winnerId != null && slot != null && String(slot.entrant_id) === String(winnerId);
  const walkover = Boolean(set.walkover) || (slots.length === 2 && slots.some(slotIsDq));
  const noShow = Boolean(set.no_show) || (slots.length === 2 && slots.every(slotIsDq));
  const slotName = (slot) => (slot?.members?.length ? slot.members.map((member) => member.gamerTag ?? member.providerName).filter(Boolean).join(" / ") : cleanEntrantName(slot?.entrant_name));
  const winnerName = slotName(slots.find(won)) || cleanEntrantName(set.winner_entrant_name);
  const sideOf = (accountId) => slots.findIndex((slot) => (slot.members ?? []).some((member) => member.gameAccountId === accountId));
  const memberOf = (side, playerId) => (playerId == null ? null : (slots[side]?.members ?? []).find((member) => String(member.playerId) === String(playerId)) ?? null);
  const teamSide = (side) => (slots[side]?.members?.length ?? 0) > 1;
  const sidePicks = (game, side) => {
    const list = picks(game).filter((pick) => pick.side === side);
    if (!teamSide(side)) return list;
    const order = (slots[side].members ?? []).map((member) => String(member.playerId));
    const rank = (pick) => (pick.playerId == null || !order.includes(String(pick.playerId)) ? order.length : order.indexOf(String(pick.playerId)));
    return [...list].sort((left, right) => rank(left) - rank(right));
  };
  const picks = (game) => game.picks?.some((pick) => pick.entrantId != null)
    ? game.picks.map((pick, index) => {
      const side = slots.findIndex((slot) => String(slot.entrant_id) === String(pick.entrantId));
      return { key: `${pick.entrantId}:${pick.legend}:${index}`, legend: pick.legend, name: memberOf(side, pick.playerId)?.name ?? pick.name, playerId: pick.playerId ?? null, side };
    })
    : game.entrantSelections?.length
    ? game.entrantSelections.map((pick) => ({ key: `${pick.providerEntrantId}:${pick.legend}`, legend: pick.legend, side: slots.findIndex((slot) => String(slot.provider_entrant_id) === String(pick.providerEntrantId)) }))
    : (game.selections ?? []).map((pick) => ({ key: pick.gameAccountId ?? pick.name, legend: pick.legend, name: pick.name, side: sideOf(pick.gameAccountId) }));
  const scoreWinnerSide = (gameNumber) => {
    const scores = slots.map((slot) => slot?.score);
    if (scores.length !== 2 || !scores.every((score) => Number.isInteger(score) && score >= 0) || scores[0] === scores[1]) return -1;
    const total = scores[0] + scores[1];
    if (gameNumber < 1 || gameNumber > total) return -1;
    return Math.min(...scores) === 0 || gameNumber === total ? (scores[0] > scores[1] ? 0 : 1) : -1;
  };
  const winnerSide = (game) => (game.winnerEntrantId != null
    ? slots.findIndex((slot) => String(slot.entrant_id) === String(game.winnerEntrantId))
    : game.winnerProviderEntrantId == null
      ? scoreWinnerSide(Number(game.gameNumber))
      : slots.findIndex((slot) => String(slot.provider_entrant_id) === String(game.winnerProviderEntrantId)));

  return (
    <PageShell
      back={{ href: `/esports/event/${set.event_id}?view=matches`, label: !set.tournament_name || String(set.event_name || "").includes(set.tournament_name) ? set.event_name : `${set.tournament_name} · ${set.event_name}` }}
    >
      <div className="grid items-start gap-3 2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="rounded-2xl border p-3 border-slate-700 bg-slate-900/80">
        <h1 className="sr-only">{[slots.map(slotName).filter(Boolean).join(" vs "), set.round_name].filter(Boolean).join(" · ") || "Match"}</h1>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-500">
          <span>{set.tournament_id ? <a href={`/esports/tournament/${set.tournament_id}`} className="hover:text-slate-300 hover:underline">{set.tournament_name}</a> : set.tournament_name} · {set.round_name} · {date(set.history_at ?? set.starts_at)}</span>
          <span className="flex items-center gap-2">
            {setIsLive(detail.data) && <LiveUpdates updatedAt={detail.updatedAt} />}
            {set.is_official && <Badge tone="blue">Official</Badge>}
            <Badge>{modeName(set.game_mode)}</Badge>
          </span>
        </div>
        {(set.stream || set.youtube) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-200">
            {set.stream && <span aria-hidden="true">▶</span>}
            {set.stream && (set.stream.url
              ? <a href={set.stream.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{set.state === "complete" ? "Streamed" : "On stream"}: {set.stream.name} ↗</a>
              : <span>{set.state === "complete" ? "Streamed" : "On stream"}: {set.stream.name}</span>)}
            <span className={`flex flex-wrap items-center gap-2 ${set.stream ? "sm:ml-auto" : ""}`}>
              {set.youtube && (
                <a href={set.youtube.url} target="_blank" rel="noopener noreferrer" title={youtubeTitle(set.youtube)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-black text-white hover:bg-red-500">
                  <span className="rounded bg-white/20 px-1">YouTube</span>{youtubeLabel(set.youtube)} ↗
                </a>
              )}
              {set.stream?.vod && (
                <a href={set.stream.vod.url} target="_blank" rel="noopener noreferrer" title={vodTitle(set.stream)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-black text-white hover:bg-violet-500">
                  <span className="rounded bg-white/20 px-1">Twitch</span>VOD at {set.stream.vod.estimated ? "about " : ""}{vodTime(set.stream.vod.offsetSeconds)} ↗
                </a>
              )}
            </span>
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
          {[0, 1].map((index) => {
            const slot = slots[index];
            const side = (
              <div key={index} className={`flex min-w-0 flex-col gap-2 ${index ? "items-end text-right" : ""}`}>
                {(slot?.members?.length ? slot.members : [{ gamerTag: cleanEntrantName(slot?.entrant_name) }]).map((member) => (
                  <span key={member.identityId ?? member.gamerTag} className={`flex min-w-0 max-w-full items-center gap-2 sm:gap-3 ${index ? "flex-row-reverse" : ""}`}>
                    <a href={member.playerId ? `/esports/player/id/${member.playerId}` : undefined} className={`flex min-w-0 items-center gap-2 sm:gap-3 ${index ? "flex-row-reverse" : ""} hover:opacity-80`}>
                      <Avatar src={member.image} name={member.gamerTag} playerId={member.playerId} />
                      <span className={`truncate text-base font-black sm:text-lg ${won(slot) ? "text-white" : winnerId != null ? "text-slate-500" : "text-slate-200"}`}>{member.gamerTag ?? "TBD"}</span>
                    </a>
                    {member.legends?.length > 0 && (
                      <span className={`flex shrink-0 gap-0.5 ${index ? "flex-row-reverse" : ""}`}>
                        {member.legends.map((pick) => (
                          <img key={pick.legend} src={`${host}/game/legends/art/${encodeURIComponent(pick.legend)}`} alt={legendName(pick.legend)} title={`${legendName(pick.legend)} · ${pick.games} ${pick.games === 1 ? "game" : "games"}`} loading="lazy" className="h-7 w-7 rounded-full border border-slate-700 bg-slate-800 object-cover" />
                        ))}
                      </span>
                    )}
                  </span>
                ))}
                {slot && slotIsDq(slot) && !won(slot) && <Badge tone="red" title="Disqualified or didn't show up">DQ</Badge>}
              </div>
            );
            return index === 0 ? side : [
              walkover
                ? (
                  <div key="score" className="text-center">
                    <div className="text-lg font-black leading-tight text-white sm:text-2xl">{noShow ? "Both no-show" : "Won by DQ"}</div>
                    {noShow && winnerName && <div className="mt-1 text-sm font-semibold text-slate-400">{winnerName} advanced</div>}
                  </div>
                )
                : (
                  <div key="score" className="text-center text-3xl font-black tabular-nums text-white sm:text-4xl">
                    {slots[0]?.score ?? (winnerId != null ? (won(slots[0]) ? "W" : "L") : "–")}<span className="mx-2 text-slate-400">:</span>{slots[1]?.score ?? (winnerId != null ? (won(slots[1]) ? "W" : "L") : "–")}
                  </div>
                ),
              side,
            ];
          })}
        </div>
        <div className="mt-3"><ProviderLink provider={set.provider} url={set.url} /></div>
      </section>

      <Card title="Games" padded={false}>
        {!games.length && <Empty>{walkover ? "No games were played." : "Game-by-game details weren't reported for this match."}</Empty>}
        {games.map((game) => (
          <div key={game.providerGameId ?? game.gameNumber} className="grid gap-3 border-b px-3 py-3 last:border-0 border-slate-800 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="flex items-center gap-3">
              <img src={`${host}/game/maps/thumbnail/${encodeURIComponent(game.map ?? "")}`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-12 w-20 rounded-md object-cover bg-slate-800" />
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Game {game.gameNumber}</div>
                <div className="font-black text-white">{mapName(game.map)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((side) => (
                <div key={side} className={`flex items-center gap-2 ${side ? "flex-row-reverse" : ""} ${teamSide(side) ? "" : "flex-wrap"}`}>
                  {winnerSide(game) >= 0 && (
                    <span className={`w-6 shrink-0 text-center font-mono text-lg font-black ${winnerSide(game) === side ? "text-emerald-500" : "text-rose-500"}`}>{winnerSide(game) === side ? "W" : "L"}</span>
                  )}
                  <span className={`flex min-w-0 gap-2 ${teamSide(side) ? `flex-col ${side ? "items-end" : "items-start"}` : `flex-wrap ${side ? "flex-row-reverse" : ""}`}`}>
                    {sidePicks(game, side).map((pick) => (
                      <span key={pick.key} className={`flex min-w-0 max-w-full items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm font-bold bg-slate-800 ${side && teamSide(side) ? "flex-row-reverse pl-2 pr-1" : ""}`}>
                        <img src={`${host}/game/legends/art/${encodeURIComponent(pick.legend ?? "")}`} alt={legendName(pick.legend)} title={legendName(pick.legend)} loading="lazy" className="h-7 w-7 shrink-0 rounded-md object-cover" />
                        <span className={`shrink-0 text-white ${teamSide(side) ? "hidden sm:inline" : ""}`}>{legendName(pick.legend)}</span>
                        {pick.name && <span className="min-w-0 truncate text-xs text-slate-500">{pick.name}</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
      </div>
    </PageShell>
  );
}
