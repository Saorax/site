import { useMemo } from 'react';
import { Pill } from './Pill';
import { cx } from './tones';

const legacyName = (step) => String(step?.CostumeName || step?.PodiumName || step?.WeaponSkinName || '').trim();
const legacyId = (step) => String(step?.CostumeID ?? step?.PodiumID ?? step?.WeaponSkinID ?? '').trim();

export function buildChainLookup(items, nameOf, nextOf) {
  const lookup = new Map();
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    const name = String(nameOf(item) || '').trim();
    if (name && item?.chain?.id && item.chain.stages > 1) lookup.set(name, item.chain);
  }
  if (lookup.size) return lookup;
  for (const item of list) {
    const steps = Array.isArray(item?.upgradeChain) ? item.upgradeChain : [];
    const names = steps.map(legacyName);
    if (names.length < 2 || names.some((name) => !name)) continue;
    const chain = {
      id: `legacy:${names[0]}`,
      stages: names.length,
      name: '',
      items: steps.map((step, index) => ({ stage: index + 1, name: names[index], id: legacyId(step) })),
    };
    names.forEach((name, index) => {
      const current = lookup.get(name);
      if (!current || current.stages < chain.stages) lookup.set(name, { ...chain, stage: index + 1 });
    });
  }
  if (lookup.size || !nextOf) return lookup;
  const byName = new Map(list.map((item) => [String(nameOf(item) || '').trim(), item]).filter(([name]) => name));
  const targets = new Set(list.map((item) => String(nextOf(item) || '').trim()).filter((name) => byName.has(name)));
  for (const [start, item] of byName) {
    if (targets.has(start) || !byName.has(String(nextOf(item) || '').trim())) continue;
    const members = [item];
    const seen = new Set([start]);
    let current = item;
    while (byName.has(String(nextOf(current) || '').trim()) && !seen.has(String(nextOf(current) || '').trim())) {
      const next = String(nextOf(current)).trim();
      seen.add(next);
      current = byName.get(next);
      members.push(current);
    }
    const chain = {
      id: `legacy:${start}`,
      stages: members.length,
      name: '',
      items: members.map((member, index) => ({ stage: index + 1, name: String(nameOf(member)).trim(), id: '' })),
    };
    chain.items.forEach((entry) => lookup.set(entry.name, { ...chain, stage: entry.stage }));
  }
  return lookup;
}

export function useChainLookup(items, nameOf, nextOf) {
  return useMemo(() => buildChainLookup(items, nameOf, nextOf), [items]);
}

export function groupChains(list, chainOf) {
  const out = [];
  const at = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const chain = chainOf(item);
    if (!chain?.id) {
      out.push(item);
      continue;
    }
    const position = at.get(chain.id);
    if (position === undefined) {
      at.set(chain.id, out.length);
      out.push(item);
    } else if ((chainOf(out[position])?.stage || 0) > (chain.stage || 0)) {
      out[position] = item;
    }
  }
  return out;
}

export const chainStageCount = (list, chainOf) => (Array.isArray(list) ? list : []).filter((item) => chainOf(item)?.stage > 1).length;

export function ChainPill({ chain, className = '' }) {
  if (!chain?.stages || chain.stages < 2) return null;
  return (
    <Pill tone="emerald" title={`Upgrades through ${chain.stages} stages`} className={className}>
      {chain.stages} stages
    </Pill>
  );
}

export function stageGoal(stage) {
  if (!stage?.goal) return '';
  if (!stage.count) return stage.goal;
  const count = Number(stage.count).toLocaleString('en-US');
  const [, first, rest] = String(stage.goal).match(/^(.+?[.!?])\s+(.+)$/) || [];
  if (first && rest) return `${first.replace(/[.!?]$/, '')}: ${count}. ${rest.replace(/!$/, '.')}`;
  return `${String(stage.goal).replace(/[.!]$/, '')}: ${count}`;
}

export function ChainStages({ chain, current, onPick, full = false, firstLabel = 'Comes first', className = '' }) {
  if (!chain?.items?.length || chain.items.length < 2) return null;
  const active = current || chain.stage;
  return (
    <div className={cx('space-y-1', className)}>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Upgrade stages</div>
      <ul className="grid gap-1 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
        {chain.items.map((stage) => {
          const selected = stage.stage === active;
          const goal = stage.stage === 1 ? firstLabel : stageGoal(stage) || 'Upgrade mission';
          return (
            <li key={stage.stage}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => !selected && onPick?.(stage)}
                className={cx(
                  'flex h-full w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition',
                  selected ? 'border-emerald-400/70 bg-emerald-500/15 text-white' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500 hover:bg-slate-900',
                )}
              >
                <span className={cx('shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold', selected ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-100')}>
                  Stage {stage.stage}
                </span>
                <span className="min-w-0">
                  <span className="block break-words">{goal}</span>
                  {full && <span className="block break-all font-mono text-[11px] text-slate-400">{stage.name}{stage.id ? ` · ID ${stage.id}` : ''}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
