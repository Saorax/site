import { useMemo, useState } from 'react';
import { CountPill, CountPills, EmptyState, ErrorState, Img, ImgPlaceholder, LoadingState, PageHeader, PageShell, ScrollX, Section, Tabs, apiUrl, cx, legendHref, portraitUrl, useApi, useQueryState, weaponIconUrl, weaponName } from '../ui';

const WEAPON_ORDER = ['Sword', 'Hammer', 'Pistol', 'RocketLance', 'Spear', 'Katar', 'Axe', 'Bow', 'Fists', 'Scythe', 'Cannon', 'Orb', 'Greatsword', 'Boots', 'Chakram'];
const DAY = 86400000;
const number = new Intl.NumberFormat('en-US');

const isBeta = (legend) => Boolean(legend?.beta?.isBeta || legend?.tags?.includes?.('beta') || String(legend?.id || '').startsWith('beta-'));

const releaseMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 100000000000 ? numeric * 1000 : numeric;
};

const shortDate = (ms) => (ms ? new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');
const daysText = (days) => (days === null ? '' : days === 0 ? 'today' : days === 1 ? '1 day ago' : `${number.format(days)} days ago`);
const weaponSlug = (weapon) => weaponName(weapon).replace(/\s+/g, '');
const pairKey = (a, b, index) => (index.get(a) <= index.get(b) ? `${a}|${b}` : `${b}|${a}`);

export function buildChart(rows, now = Date.now()) {
  const legends = (Array.isArray(rows) ? rows : [])
    .filter((legend) => !isBeta(legend))
    .map((legend) => {
      const name = legend?.bio?.name?.normal || legend?.name || legend?.codeName || '';
      const weapons = [legend?.weapons?.main?.name, legend?.weapons?.secondary?.name].filter(Boolean);
      return { name, href: legendHref(name), image: portraitUrl({ name }), weapons, release: releaseMs(legend?.release), order: Number(legend?.releaseOrder) || 0 };
    })
    .filter((legend) => legend.name && legend.weapons.length === 2 && legend.weapons[0] !== legend.weapons[1])
    .sort((a, b) => (a.release ?? Infinity) - (b.release ?? Infinity) || a.order - b.order || a.name.localeCompare(b.name));
  const present = new Set(legends.flatMap((legend) => legend.weapons));
  const weapons = [...WEAPON_ORDER.filter((weapon) => present.has(weapon)), ...[...present].filter((weapon) => !WEAPON_ORDER.includes(weapon)).sort()];
  const index = new Map(weapons.map((weapon, position) => [weapon, position]));
  const pairs = new Map();
  for (const legend of legends) {
    const key = pairKey(legend.weapons[0], legend.weapons[1], index);
    pairs.set(key, [...(pairs.get(key) || []), legend]);
  }
  const perWeapon = weapons.map((weapon) => {
    const list = legends.filter((legend) => legend.weapons.includes(weapon));
    const newest = list.reduce((best, legend) => (legend.release && (!best || legend.release > best.release) ? legend : best), null);
    const partners = new Set(list.map((legend) => legend.weapons.find((other) => other !== weapon)));
    return {
      weapon,
      legends: list,
      count: list.length,
      first: list[0] || null,
      newest,
      days: newest?.release ? Math.max(0, Math.floor((now - newest.release) / DAY)) : null,
      missing: weapons.filter((other) => other !== weapon && !partners.has(other)),
    };
  });
  const open = [];
  for (let a = 0; a < weapons.length; a += 1) {
    for (let b = a + 1; b < weapons.length; b += 1) {
      if (!pairs.has(`${weapons[a]}|${weapons[b]}`)) open.push([weapons[a], weapons[b]]);
    }
  }
  const years = new Map();
  for (const legend of legends) {
    if (!legend.release) continue;
    const year = new Date(legend.release).getUTCFullYear();
    years.set(year, [...(years.get(year) || []), legend]);
  }
  return {
    legends,
    weapons,
    index,
    pairs,
    perWeapon,
    open,
    years: [...years.entries()].sort((a, b) => a[0] - b[0]).map(([year, list]) => ({ year, legends: list })),
    combinations: (weapons.length * (weapons.length - 1)) / 2,
    usedPairs: pairs.size,
  };
}

function WeaponIcon({ weapon, className = 'h-6 w-6' }) {
  return <Img src={weaponIconUrl(weapon)} alt={weaponName(weapon)} title={weaponName(weapon)} className={cx('shrink-0 object-contain', className)} fallback={<ImgPlaceholder className={className} label={weaponName(weapon).slice(0, 2)} />} />;
}

function Face({ legend, className = 'h-8 w-8', title }) {
  return (
    <a href={legend.href} title={title || legend.name} className="shrink-0 rounded-md transition hover:ring-2 hover:ring-blue-400">
      <Img src={legend.image} alt={legend.name} className={cx('rounded-md bg-slate-950 object-contain', className)} fallback={<ImgPlaceholder className={cx('rounded-md', className)} label={legend.name.slice(0, 2)} />} />
    </a>
  );
}

function WeaponButton({ weapon, active, onPick, onMouseEnter, children, className = '' }) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={() => onPick(active ? '' : weapon)}
      aria-pressed={active}
      title={active ? `Clear ${weaponName(weapon)}` : `Pick ${weaponName(weapon)}`}
      className={cx('rounded-lg transition', active ? 'bg-blue-500/25 ring-1 ring-blue-400' : 'hover:bg-slate-800', className)}
    >
      {children}
    </button>
  );
}

function Chart({ chart, selected, onPick }) {
  const [hover, setHover] = useState(null);
  const { weapons, index, pairs } = chart;
  const columns = { gridTemplateColumns: `repeat(${weapons.length + 1}, minmax(1.75rem, 1fr))` };
  const header = (weapon, key, axis) => (
    <WeaponButton
      key={key}
      weapon={weapon}
      active={weapon === selected}
      onPick={onPick}
      onMouseEnter={() => setHover(axis === 0 ? [weapon, null] : [null, weapon])}
      className={cx('grid aspect-square place-items-center bg-slate-950 p-0.5', hover?.[axis] === weapon && weapon !== selected && 'bg-slate-800')}
    >
      <WeaponIcon weapon={weapon} className="h-full max-h-9 w-full max-w-9" />
    </WeaponButton>
  );
  return (
    <ScrollX hint="More weapons →">
      <div className="grid min-w-[30rem] gap-px rounded-lg bg-slate-800/60 p-px" style={columns} onMouseLeave={() => setHover(null)}>
        <div className="aspect-square rounded-tl-lg bg-slate-950" />
        {weapons.map((weapon) => header(weapon, `top-${weapon}`, 1))}
        {weapons.map((row) => (
          <div key={row} className="contents">
            {header(row, `left-${row}`, 0)}
            {weapons.map((column) => {
              const crossed = hover && (row === hover[0] || column === hover[1]);
              const picked = selected && (row === selected || column === selected);
              const faded = selected && !picked;
              const enter = () => setHover([row, column]);
              if (row === column) {
                return <div key={column} onMouseEnter={enter} className={cx('aspect-square bg-slate-900', (crossed || picked) && 'bg-blue-500/10')} />;
              }
              const legends = pairs.get(pairKey(row, column, index)) || [];
              const label = `${weaponName(row)} + ${weaponName(column)}`;
              if (!legends.length) {
                return (
                  <div
                    key={column}
                    title={`No legend has ${label}`}
                    onMouseEnter={enter}
                    className={cx('relative aspect-square bg-slate-950/80', (crossed || picked) && 'bg-blue-500/10', faded && 'opacity-40')}
                  >
                    <WeaponIcon weapon={row} className="absolute left-[8%] top-[8%] h-[42%] w-[42%] opacity-25" />
                    <WeaponIcon weapon={column} className="absolute bottom-[8%] right-[8%] h-[42%] w-[42%] opacity-25" />
                  </div>
                );
              }
              const legend = legends[legends.length - 1];
              return (
                <a
                  key={column}
                  href={legend.href}
                  title={`${legends.map((entry) => entry.name).join(', ')}: ${label}`}
                  onMouseEnter={enter}
                  onFocus={enter}
                  className={cx('relative block aspect-square bg-slate-900 transition hover:z-10 hover:ring-2 hover:ring-blue-400 focus-visible:z-10', (crossed || picked) && 'bg-blue-500/20', faded && 'opacity-30')}
                >
                  <Img src={legend.image} alt={legend.name} className="h-full w-full object-contain" fallback={<ImgPlaceholder className="h-full w-full" label={legend.name.slice(0, 2)} />} />
                  {legends.length > 1 && <span className="absolute bottom-0 right-0 rounded-tl bg-slate-950/90 px-0.5 text-[10px] font-bold text-white">{legends.length}</span>}
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </ScrollX>
  );
}

function Picked({ chart, selected, onPick }) {
  const row = chart.perWeapon.find((entry) => entry.weapon === selected);
  if (!row) return <p className="text-sm text-slate-400">Pick a weapon to see its legends and the weapons it was never paired with.</p>;
  const most = chart.weapons.length - 1;
  return (
    <div className="@container rounded-xl border border-blue-400/40 bg-blue-500/5 p-2">
      <div className="grid gap-2 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <WeaponIcon weapon={selected} className="h-7 w-7" />
            <span className="font-bold text-white">{weaponName(selected)}</span>
            <span className="text-sm text-slate-400">{row.count} of {most} pairs</span>
            <button type="button" onClick={() => onPick('')} className="ml-auto rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Clear</button>
          </div>
          <ul className="grid gap-1 @sm:grid-cols-2 @5xl:grid-cols-3">
            {row.legends.map((legend) => {
              const other = legend.weapons.find((weapon) => weapon !== selected);
              return (
                <li key={legend.name} className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-950/60 px-1.5 py-1">
                  <Face legend={legend} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <a href={legend.href} className="block truncate text-sm font-bold text-white hover:underline">{legend.name}</a>
                    <div className="text-xs text-slate-400">{shortDate(legend.release)}</div>
                  </div>
                  <button type="button" onClick={() => onPick(other)} title={`Pick ${weaponName(other)}`} className="flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs text-slate-300 hover:bg-slate-800">
                    <WeaponIcon weapon={other} className="h-5 w-5" />
                    <span className="hidden sm:inline">{weaponName(other)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-sm font-bold text-white">No legend yet with <span className="font-normal text-slate-400">{row.missing.length}</span></div>
          {row.missing.length ? (
            <ul className="flex flex-wrap gap-1">
              {row.missing.map((weapon) => (
                <li key={weapon}>
                  <button type="button" onClick={() => onPick(weapon)} className="flex items-center gap-1 rounded-lg bg-slate-950/60 px-1.5 py-1 text-xs text-slate-200 hover:bg-slate-800">
                    <WeaponIcon weapon={weapon} className="h-5 w-5" />
                    {weaponName(weapon)}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">Paired with every weapon.</p>}
        </div>
      </div>
    </div>
  );
}

const SORTS = [
  { value: 'fewest', label: 'Fewest' },
  { value: 'most', label: 'Most' },
  { value: 'order', label: 'Weapon order' },
];

function PerWeapon({ chart, selected, onPick }) {
  const [sort, setSort] = useState('fewest');
  const most = chart.weapons.length - 1;
  const rows = useMemo(() => {
    const list = [...chart.perWeapon];
    if (sort === 'order') return list;
    const direction = sort === 'most' ? -1 : 1;
    return list.sort((a, b) => direction * (a.count - b.count) || (a.days ?? 0) - (b.days ?? 0));
  }, [chart, sort]);
  return (
    <Section title="Legends per weapon" headingAs="h2" padded={false} actions={<Tabs items={SORTS} value={sort} onChange={setSort} variant="small" label="Sort weapons" />} bodyClassName="divide-y divide-slate-800">
      {rows.map((row) => (
        <div key={row.weapon} className={cx('grid gap-1.5 px-3 py-2', row.weapon === selected && 'bg-blue-500/10')}>
          <div className="flex items-center gap-2">
            <WeaponButton weapon={row.weapon} active={row.weapon === selected} onPick={onPick} className="flex min-w-0 items-center gap-2 px-1 py-0.5">
              <WeaponIcon weapon={row.weapon} className="h-6 w-6" />
              <span className="truncate text-sm font-bold text-white">{weaponName(row.weapon)}</span>
            </WeaponButton>
            <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div className="h-full rounded-full bg-blue-400" style={{ width: `${(row.count / Math.max(1, most)) * 100}%` }} />
            </div>
            <span className="shrink-0 text-sm tabular-nums text-slate-300">{row.count}<span className="text-slate-500">/{most}</span></span>
          </div>
          <div className="flex flex-wrap gap-1">
            {row.legends.map((legend) => <Face key={legend.name} legend={legend} className="h-7 w-7" title={`${legend.name}: ${legend.weapons.map(weaponName).join(' + ')}`} />)}
          </div>
        </div>
      ))}
    </Section>
  );
}

function Newest({ chart, selected, onPick }) {
  const rows = [...chart.perWeapon].sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  return (
    <Section title="Newest legend per weapon" headingAs="h2" padded={false} bodyClassName="divide-y divide-slate-800">
      {rows.map((row) => (
        <div key={row.weapon} className={cx('flex items-center gap-2 px-3 py-1.5', row.weapon === selected && 'bg-blue-500/10')}>
          <WeaponButton weapon={row.weapon} active={row.weapon === selected} onPick={onPick} className="flex w-32 shrink-0 items-center gap-2 px-1 py-0.5 sm:w-36">
            <WeaponIcon weapon={row.weapon} className="h-6 w-6" />
            <span className="truncate text-sm font-bold text-white">{weaponName(row.weapon)}</span>
          </WeaponButton>
          {row.newest ? (
            <>
              <Face legend={row.newest} className="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <a href={row.newest.href} className="block truncate text-sm text-slate-200 hover:underline">{row.newest.name}</a>
                <div className="text-xs text-slate-500 sm:hidden">{shortDate(row.newest.release)}</div>
              </div>
              <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{shortDate(row.newest.release)}</span>
              <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-300">{daysText(row.days)}</span>
            </>
          ) : <span className="text-sm text-slate-500">None</span>}
        </div>
      ))}
    </Section>
  );
}

function OpenPairs({ chart, selected, onPick }) {
  const list = selected ? chart.open.filter((pair) => pair.includes(selected)) : chart.open;
  return (
    <Section
      title="Pairs no legend has"
      count={selected ? `${list.length} with ${weaponName(selected)}` : list.length}
      headingAs="h2"
      bodyClassName="@container p-3!"
      padded={false}
    >
      {list.length ? (
        <ul className="grid grid-cols-1 gap-1 @md:grid-cols-2 @3xl:grid-cols-3">
          {list.map(([a, b]) => (
            <li key={`${a}|${b}`} className="flex min-w-0 items-center gap-1 rounded-lg bg-slate-950/60 px-1.5 py-1 text-sm text-slate-200">
              <button type="button" onClick={() => onPick(a)} title={`Pick ${weaponName(a)}`} className="flex min-w-0 items-center gap-1 rounded-md hover:text-white">
                <WeaponIcon weapon={a} className="h-5 w-5" />
                <span className="truncate">{weaponName(a)}</span>
              </button>
              <span className="text-slate-500">+</span>
              <button type="button" onClick={() => onPick(b)} title={`Pick ${weaponName(b)}`} className="flex min-w-0 items-center gap-1 rounded-md hover:text-white">
                <WeaponIcon weapon={b} className="h-5 w-5" />
                <span className="truncate">{weaponName(b)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState bare title="Every pair has a legend" />}
    </Section>
  );
}

function Years({ chart }) {
  const most = Math.max(1, ...chart.years.map((row) => row.legends.length));
  return (
    <Section title="Legends per year" headingAs="h2" padded={false} bodyClassName="divide-y divide-slate-800">
      {chart.years.map((row) => (
        <div key={row.year} className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-2 px-3 py-1.5">
          <div>
            <div className="text-sm font-bold tabular-nums text-white">{row.year}</div>
            <div className="text-xs tabular-nums text-slate-400">{row.legends.length}</div>
          </div>
          <div className="min-w-0">
            <div className="mb-1 h-1 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${(row.legends.length / most) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-1">
              {row.legends.map((legend) => <Face key={legend.name} legend={legend} className="h-7 w-7" title={`${legend.name}, ${shortDate(legend.release)}`} />)}
            </div>
          </div>
        </div>
      ))}
    </Section>
  );
}

export default function WeaponChart() {
  const { data, error, loading, retry } = useApi(apiUrl('/game/legends/summary'));
  const chart = useMemo(() => buildChart(data), [data]);
  const [weaponParam, setWeaponParam] = useQueryState('weapon', '');
  const selected = useMemo(() => {
    const wanted = String(weaponParam || '').toLowerCase();
    if (!wanted) return '';
    return chart.weapons.find((weapon) => weapon.toLowerCase() === wanted || weaponSlug(weapon).toLowerCase() === wanted) || '';
  }, [chart, weaponParam]);
  const onPick = (weapon) => setWeaponParam(weapon ? weaponSlug(weapon) : '');

  return (
    <PageShell>
      <PageHeader
        title="Weapon Chart"
        actions={chart.legends.length ? (
          <CountPills>
            <CountPill label="Legends" value={chart.legends.length} href="/game/legends" />
            <CountPill label="Weapons" value={chart.weapons.length} />
            <CountPill label="Pairs used" value={`${chart.usedPairs} of ${chart.combinations}`} tone="blue" />
            <CountPill label="Pairs left" value={chart.open.length} tone="amber" />
          </CountPills>
        ) : null}
      />

      {error && !data && <ErrorState message="Couldn't load the legends." detail={error} onRetry={retry} />}
      {loading && !data && <LoadingState label="Loading legends…" />}

      {chart.legends.length > 0 && (
        <div className="grid items-start gap-3 xl:grid-cols-2 min-[112.5rem]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,3fr)]">
          <div className="grid min-w-0 gap-3">
            <Section title="Weapon pairs" headingAs="h2" padded={false} bodyClassName="space-y-2 p-2 sm:p-3">
              <Chart chart={chart} selected={selected} onPick={onPick} />
              <Picked chart={chart} selected={selected} onPick={onPick} />
            </Section>
            <OpenPairs chart={chart} selected={selected} onPick={onPick} />
          </div>
          <div className="grid min-w-0 items-start gap-3 min-[112.5rem]:col-span-2 min-[112.5rem]:grid-cols-2">
            <PerWeapon chart={chart} selected={selected} onPick={onPick} />
            <div className="grid min-w-0 gap-3">
              <Newest chart={chart} selected={selected} onPick={onPick} />
              <Years chart={chart} />
            </div>
          </div>
        </div>
      )}

      {data && !chart.legends.length && <EmptyState title="No legends to chart" />}
    </PageShell>
  );
}
