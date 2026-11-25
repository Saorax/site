import { useState } from 'react';
import { Img, PageShell } from '../ui';
import SiteSearch from '../ui/SiteSearch';
import { sections } from '../../data/sections';
import { LatestPatchTile, LatestWinnerTile, NewestLegendTile, OnNowTile, RegionLeadersTile } from './LiveTiles';
import { ToolGroup, WhatsNew } from './ToolCards';
import { useLatestPatch, useNewestLegend, useRegionLeaders } from './live';

const order = ['competitive', 'ranked', 'game', 'bifrost'];

export default function HomePage() {
  const legend = useNewestLegend();
  const patch = useLatestPatch();
  const [mode, setMode] = useState('1');
  const leaders = useRegionLeaders(Number(mode));
  const groups = order.map((key) => sections.find((section) => section.key === key)).filter(Boolean);
  return (
    <PageShell>
      <header className="relative rounded-2xl border border-slate-700 bg-gradient-to-br from-blue-500/20 via-slate-900 to-slate-900 p-3 shadow-sm">
        {legend.legend?.image && (
          <div className="pointer-events-none absolute inset-0 hidden overflow-hidden rounded-2xl lg:block" aria-hidden="true">
            <Img src={legend.legend.image} alt="" className="absolute -bottom-6 right-6 h-64 w-64 object-contain opacity-50 xl:right-10 xl:opacity-70" />
          </div>
        )}
        <div className="relative max-w-3xl">
          <h1 className="text-2xl font-bold text-white sm:text-4xl">Brawlhalla rankings, results and game data</h1>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Results from start.gg and Challengermode. Legend, move and patch data from the game files.
          </p>
          <div className="mt-3 max-w-2xl">
            <SiteSearch variant="page" limit={5} />
          </div>
          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
            <a href="/pr" className="rounded-xl border border-blue-400 bg-blue-500 px-3 py-2 text-sm font-bold text-white hover:bg-blue-400">Power Rankings</a>
            <a href="/esports/player" className="rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm font-bold text-slate-200 hover:border-slate-400">Find a player</a>
            <a href="/game/legends" className="rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm font-bold text-slate-200 hover:border-slate-400">Legends</a>
            <a href="/game/patch" className="rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm font-bold text-slate-200 hover:border-slate-400">Patch notes</a>
          </div>
        </div>
      </header>

      <div id="live" className="grid scroll-mt-20 gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <RegionLeadersTile leaders={leaders} mode={mode} onModeChange={setMode} className="md:row-span-2" />
        <OnNowTile className="md:row-span-2" />
        <LatestWinnerTile />
        <NewestLegendTile data={legend} />
        <LatestPatchTile data={patch} className="md:col-span-2" />
      </div>

      {groups.map((section) => (
        <ToolGroup key={section.key} section={section} columns="sm:grid-cols-2 lg:grid-cols-3 min-[112.5rem]:grid-cols-4 min-[150rem]:grid-cols-5" />
      ))}

      <WhatsNew limit={6} listClassName="grid gap-x-3 gap-y-0.5 md:grid-cols-2 xl:grid-cols-3" />
    </PageShell>
  );
}
