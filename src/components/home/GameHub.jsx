import { PageHeader, PageShell } from '../ui';
import { sectionByKey } from '../../data/sections';
import { LatestPatchTile, NewestLegendTile } from './LiveTiles';
import { ToolCard, WhatsNew, sectionTones } from './ToolCards';
import { dateText, useComboLists, useLatestPatch, useNewestLegend, useStoreDataVersion } from './live';

export default function GameHub() {
  const legend = useNewestLegend();
  const patch = useLatestPatch();
  const combos = useComboLists();
  const store = useStoreDataVersion();
  const game = sectionByKey('game');
  const current = patch.current;
  const storeNote = store.patch && store.patch !== current?.patch ? `store data from ${store.patch}` : null;
  return (
    <PageShell>
      <PageHeader
        title="Game data"
        meta={current ? [`Data from patch ${current.patch}${current.date ? `, ${dateText(current.date)}` : ''}`, storeNote].filter(Boolean).join(' · ') : undefined}
      />

      <div className="space-y-3 min-[112.5rem]:grid min-[112.5rem]:grid-cols-[24rem_minmax(0,1fr)] min-[112.5rem]:grid-rows-[auto_1fr] min-[112.5rem]:gap-3 min-[112.5rem]:space-y-0">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 min-[112.5rem]:grid-cols-1">
          <NewestLegendTile data={legend} />
          <LatestPatchTile data={patch} className="lg:col-span-2 min-[112.5rem]:col-span-1" />
        </div>

        <section aria-labelledby="game-tools" className="min-w-0 self-start rounded-2xl border border-blue-400/40 bg-slate-900/80 p-3 shadow-sm min-[112.5rem]:col-start-2 min-[112.5rem]:row-span-2 min-[112.5rem]:row-start-1">
          <h2 id="game-tools" className="text-lg font-bold text-white">Tools</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 min-[137.5rem]:grid-cols-4 min-[150rem]:grid-cols-5">
            {game.tools.map((tool) => <ToolCard key={tool.href} tool={tool} tone={sectionTones.game} size="large" note={tool.href === '/game/combos' ? combos.note : ''} />)}
          </div>
        </section>

        <WhatsNew area="Game" limit={4} className="self-start min-[112.5rem]:col-start-1 min-[112.5rem]:row-start-2" listClassName="grid gap-x-3 gap-y-0.5 md:grid-cols-2 xl:grid-cols-4 min-[112.5rem]:grid-cols-1" />
      </div>
    </PageShell>
  );
}
