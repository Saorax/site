import { useMemo } from 'react';
import { host } from "../../stuff";
import { CountPill, CountPills, EmptyState, ErrorState, LoadingState, PageHeader, PageShell, Pill, SearchInput, SelectInput, SidebarHeader, SkeletonGrid, Toggle, WEAPON_LABELS, cx, legendHref, useApi, useQueryFlag, useQueryList, useQueryState, weaponName } from '../ui';

const normalizeString = (str) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const apiAsset = (src) => typeof src === 'string' && src.startsWith('/game/') ? `${host}${src}` : src;

const statRows = [
    { key: 'str', label: 'Strength', icon: '/game/attack.png', color: 'from-red-500 to-orange-400' },
    { key: 'dex', label: 'Dexterity', icon: '/game/dexterity.png', color: 'from-yellow-400 to-amber-300' },
    { key: 'def', label: 'Defense', icon: '/game/defense.png', color: 'from-blue-500 to-cyan-400' },
    { key: 'spe', label: 'Speed', icon: '/game/speed.png', color: 'from-emerald-500 to-lime-400' },
];

const weaponList = [
    "Sword", "Hammer", "Pistol", "RocketLance", "Spear", "Katar", "Axe",
    "Bow", "Fists", "Scythe", "Cannon", "Orb", "Greatsword", "Boots", "Chakram",
];

const weaponLabelSet = new Set(Object.values(WEAPON_LABELS));

const sortOptions = [
    { value: 'releaseAsc', label: 'Release Order' },
    { value: 'releaseDesc', label: 'Newest First' },
    { value: 'nameAsc', label: 'Name A-Z' },
    { value: 'nameDesc', label: 'Name Z-A' },
    { value: 'strengthDesc', label: 'Highest Strength' },
    { value: 'dexterityDesc', label: 'Highest Dexterity' },
    { value: 'defenseDesc', label: 'Highest Defense' },
    { value: 'speedDesc', label: 'Highest Speed' },
];

function isBetaLegend(legend) {
    if (!legend) return false;
    return !!legend.beta?.isBeta || legend.tags?.includes?.('beta') || String(legend.id || '').startsWith('beta-');
}

function releaseMs(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric < 100000000000 ? numeric * 1000 : numeric;
}

function releaseDate(value) {
    const ms = releaseMs(value);
    if (!ms) return 'Unknown';
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function statValue(legend, key) {
    const value = Number(legend?.stances?.[key]);
    return Number.isFinite(value) ? value : 0;
}

function statPipIcon(value, index) {
    if (index === 0 && value >= 1) return '742';
    if (index === 9 && value < 10) return '753';
    if (index === 9 && value === 10) return '751';
    if (value >= index + 1) return '745';
    return '749';
}

function weaponIcon(weapon) {
    return `${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon}`;
}

function weaponNames(legend) {
    return [legend?.weapons?.main?.name, legend?.weapons?.secondary?.name].filter(Boolean);
}

function weaponSlug(weapon) {
    return weaponName(weapon).replace(/\s+/g, '');
}

function weaponFromParam(value) {
    const wanted = normalizeString(value).replace(/\s+/g, '');
    if (!wanted) return null;
    return weaponList.find((weapon) => normalizeString(weapon) === wanted || normalizeString(weaponSlug(weapon)) === wanted) || null;
}

function legendUrl(legend) {
    return legendHref(legend) || `/game/legends/${normalizeString(legend?.bio?.name?.normal)}`;
}

function sortLegends(items, sortBy) {
    const byName = (a, b) => String(a?.bio?.name?.normal || '').localeCompare(String(b?.bio?.name?.normal || ''));
    const order = (legend) => {
        const value = Number(legend?.releaseOrder);
        return Number.isFinite(value) && value > 0 ? value : null;
    };
    const byOrder = (a, b) => {
        const aOrder = order(a);
        const bOrder = order(b);
        if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
        return 0;
    };
    const byReleaseAsc = (a, b) => {
        const ordered = byOrder(a, b);
        if (ordered) return ordered;
        const aRelease = releaseMs(a.release);
        const bRelease = releaseMs(b.release);
        if (!aRelease && !bRelease) return byName(a, b);
        if (!aRelease) return 1;
        if (!bRelease) return -1;
        return aRelease - bRelease || byName(a, b);
    };
    const byReleaseDesc = (a, b) => {
        const ordered = byOrder(b, a);
        if (ordered) return ordered;
        const aRelease = releaseMs(a.release);
        const bRelease = releaseMs(b.release);
        if (!aRelease && !bRelease) return byName(a, b);
        if (!aRelease) return 1;
        if (!bRelease) return -1;
        return bRelease - aRelease || byName(a, b);
    };
    const sorted = [...items];

    sorted.sort((a, b) => {
        switch (sortBy) {
            case 'releaseDesc':
                return byReleaseDesc(a, b);
            case 'nameAsc':
                return byName(a, b);
            case 'nameDesc':
                return byName(b, a);
            case 'strengthDesc':
                return statValue(b, 'str') - statValue(a, 'str') || byName(a, b);
            case 'dexterityDesc':
                return statValue(b, 'dex') - statValue(a, 'dex') || byName(a, b);
            case 'defenseDesc':
                return statValue(b, 'def') - statValue(a, 'def') || byName(a, b);
            case 'speedDesc':
                return statValue(b, 'spe') - statValue(a, 'spe') || byName(a, b);
            case 'releaseAsc':
            default:
                return byReleaseAsc(a, b);
        }
    });

    return sorted;
}

function StatIconViewer({ legend }) {
    return (
        <div className="grid gap-1.5">
            {statRows.map((stat) => {
                const value = statValue(legend, stat.key);
                return (
                    <div key={stat.key} className="grid grid-cols-[1.25rem_1fr_1.25rem] items-center gap-1.5">
                        <img src={stat.icon} className="h-5 w-5 object-contain" alt={stat.label} />
                        <div className="flex min-w-0">
                            {Array.from({ length: 10 }, (_, index) => (
                                <img
                                    key={index}
                                    src={`/game/${statPipIcon(value, index)}.png`}
                                    className="h-5 w-4 min-w-0 shrink object-fill"
                                    alt=""
                                    aria-hidden="true"
                                />
                            ))}
                        </div>
                        <span className="text-right text-xs font-bold text-slate-100">{value}</span>
                    </div>
                );
            })}
        </div>
    );
}

function LegendCard({ legend }) {
    const beta = isBetaLegend(legend);
    const aka = String(legend?.bio?.aka || '').split(', ')[0];

    return (
        <a
            href={legendUrl(legend)}
            className="group relative flex min-h-[20rem] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80 text-white shadow-sm transition hover:border-blue-400 focus-visible:border-blue-400 focus-visible:outline-none"
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent from-blue-400/10" />

            <div className="relative p-3 pb-1">
                <div className="min-w-0 pr-12">
                    <div className="truncate text-xs font-bold uppercase tracking-wide text-blue-300">
                        {aka || legend?.codeName || 'Legend'}
                    </div>
                    <h2 className="mt-0.5 truncate text-lg font-bold leading-tight sm:text-xl">
                        {legend?.bio?.name?.normal}
                    </h2>
                    <div className="mt-1 text-xs text-slate-400">
                        {releaseDate(legend.release)}
                    </div>
                </div>
                {beta && (
                    <Pill tone="amber" className="absolute right-3 top-3">Beta</Pill>
                )}
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-start px-3">
                <div className="grid w-full grid-cols-[4.5rem_1fr] items-center gap-3">
                    <div className="flex flex-col items-center gap-2">
                        {legend?.weapons?.main?.image && <img src={apiAsset(legend.weapons.main.image)} className="h-16 w-16 object-contain drop-shadow" alt={weaponName(legend.weapons.main.name)} />}
                        {legend?.weapons?.secondary?.image && <img src={apiAsset(legend.weapons.secondary.image)} className="h-16 w-16 object-contain drop-shadow" alt={weaponName(legend.weapons.secondary.name)} />}
                    </div>

                    <div className="flex h-36 items-end justify-center rounded-xl bg-slate-950/60 p-2">
                        {legend?.image && (
                            <img
                                src={apiAsset(legend.image)}
                                className="h-full w-auto object-contain drop-shadow-xl transition duration-200 group-hover:scale-105"
                                alt={`${legend?.bio?.name?.normal} icon`}
                                loading="lazy"
                            />
                        )}
                    </div>
                </div>

            </div>

            <div className="relative mt-auto p-3">
                <StatIconViewer legend={legend} />
            </div>
        </a>
    );
}


function NewestLegend({ legend }) {
    return (
        <a href={legendUrl(legend)} className="group flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wide text-blue-300">Newest</span>
            {legend.image && <img src={apiAsset(legend.image)} className="h-10 w-10 rounded-lg object-contain" alt="" />}
            <span className="font-bold text-white group-hover:text-blue-300">{legend.bio?.name?.normal}</span>
            <span className="flex items-center gap-1">
                {weaponNames(legend).map((weapon) => (
                    <img key={weapon} src={weaponIcon(weapon)} alt={weaponName(weapon)} title={weaponName(weapon)} className="h-8 w-8 object-contain" />
                ))}
            </span>
            <span className="text-slate-400">{releaseDate(legend.release)}</span>
        </a>
    );
}

function WeaponChip({ weapon, count, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cx(
                'flex min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-xs font-bold transition',
                active ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500',
            )}
        >
            <img src={weaponIcon(weapon)} alt="" className="h-6 w-6 shrink-0 object-contain" />
            <span className="min-w-0 flex-1 truncate">{weaponName(weapon)}</span>
            <span className="text-slate-400">{count}</span>
        </button>
    );
}

function TagChip({ tag, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cx(
                'rounded-lg px-2.5 py-1 text-xs font-bold transition',
                active ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
            )}
        >
            {tag}
        </button>
    );
}

function Filters({ searchTerm, setSearchTerm, sortBy, setSortBy, showBetaLegends, setShowBetaLegends, betaCount, selectedWeapon, setSelectedWeapon, weaponCounts, nonWeaponTags, selectedTags, toggleTag, filtered, resetFilters }) {
    return (
        <>
            <SidebarHeader title="Legends" as="div" />
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Name, alias or weapon" label="Search legends" className="flex-none" />
            <SelectInput label="Sort" value={sortBy} onChange={setSortBy} options={sortOptions} className="justify-between" />
            <Toggle label={`Show beta legends (${betaCount})`} checked={showBetaLegends} onChange={setShowBetaLegends} />
            <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Weapon</span>
                    <a href={selectedWeapon ? `/game/weapons?weapon=${encodeURIComponent(weaponSlug(selectedWeapon))}` : '/game/weapons'} className="text-xs font-bold text-blue-300 hover:underline">Weapon chart →</a>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    {weaponList.map((weapon) => (
                        <WeaponChip
                            key={weapon}
                            weapon={weapon}
                            count={weaponCounts.get(weapon) || 0}
                            active={selectedWeapon === weapon}
                            onClick={() => setSelectedWeapon(selectedWeapon === weapon ? null : weapon)}
                        />
                    ))}
                </div>
            </div>
            {!!nonWeaponTags.length && (
                <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Archetype tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {nonWeaponTags.map((tag) => (
                            <TagChip key={tag} tag={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                        ))}
                    </div>
                </div>
            )}
            {filtered && (
                <button type="button" onClick={resetFilters} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700">
                    Clear filters
                </button>
            )}
        </>
    );
}

function LegendData() {
    const { data, error, loading, retry } = useApi(`${host}/game/legends/summary`);
    const historyItems = useMemo(() => (Array.isArray(data) ? data : []), [data]);
    const [searchTerm, setSearchTerm] = useQueryState("search", "");
    const [weaponParam, setWeaponParam] = useQueryState("weapon", "");
    const [selectedTags, setSelectedTags] = useQueryList("tags");
    const [showBetaLegends, setShowBetaLegends] = useQueryFlag("beta");
    const [sortParam, setSortBy] = useQueryState("sort", "releaseAsc");
    const sortBy = sortOptions.some((option) => option.value === sortParam) ? sortParam : 'releaseAsc';
    const selectedWeapon = weaponFromParam(weaponParam);
    const setSelectedWeapon = (weapon) => setWeaponParam(weapon ? weaponSlug(weapon) : "");

    const betaCount = useMemo(() => historyItems.filter(isBetaLegend).length, [historyItems]);
    const liveCount = historyItems.length - betaCount;
    const visiblePool = useMemo(() => historyItems.filter((item) => showBetaLegends || !isBetaLegend(item)), [historyItems, showBetaLegends]);

    const nonWeaponTags = useMemo(() => Array.from(
        new Set(
            visiblePool.flatMap(item => item.missionTagsFull || [])
                .filter(tag => tag && !weaponList.includes(tag) && !weaponLabelSet.has(tag))
        )
    ).sort(), [visiblePool]);

    const weaponCounts = useMemo(() => {
        const counts = new Map();
        visiblePool.forEach((legend) => {
            weaponNames(legend).forEach((weapon) => counts.set(weapon, (counts.get(weapon) || 0) + 1));
        });
        return counts;
    }, [visiblePool]);

    const filteredLegends = useMemo(() => {
        const searchQuery = normalizeString(searchTerm);
        const items = historyItems.filter((item) => {
            const matchesSearch = !searchQuery
                || normalizeString(item.codeName).includes(searchQuery)
                || normalizeString(item.bio?.name?.normal).includes(searchQuery)
                || normalizeString(item.bio?.aka).includes(searchQuery)
                || normalizeString(item.bio?.botName).includes(searchQuery)
                || weaponNames(item).some((weapon) => normalizeString(weapon).includes(searchQuery) || normalizeString(weaponName(weapon)).includes(searchQuery));

            const matchesWeapon = selectedWeapon
                ? weaponNames(item).includes(selectedWeapon)
                : true;

            const matchesTags = selectedTags.every(tag => item.missionTagsFull?.includes(tag));
            const matchesBeta = showBetaLegends || !isBetaLegend(item);

            return matchesSearch && matchesWeapon && matchesTags && matchesBeta;
        });

        return sortLegends(items, sortBy);
    }, [historyItems, searchTerm, selectedWeapon, selectedTags, showBetaLegends, sortBy]);

    const newestLegend = useMemo(() => sortLegends(visiblePool, 'releaseDesc')[0], [visiblePool]);

    const toggleTag = (tag) => {
        setSelectedTags(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]);
    };

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedWeapon(null);
        setSelectedTags([]);
        setSortBy('releaseAsc');
        setShowBetaLegends(false);
    };

    const filtered = Boolean(searchTerm || selectedWeapon || selectedTags.length || sortBy !== 'releaseAsc' || showBetaLegends);
    const filterCount = (searchTerm ? 1 : 0) + (selectedWeapon ? 1 : 0) + selectedTags.length;

    return (
        <PageShell
            title="Legends"
            subtitle={loading && !data ? 'Loading' : `${filteredLegends.length} shown`}
            sidebarLabel={filterCount ? `Filters (${filterCount})` : 'Filters'}
            sidebarTitle="Legend filters"
            sidebar={(
                <Filters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    showBetaLegends={showBetaLegends}
                    setShowBetaLegends={setShowBetaLegends}
                    betaCount={betaCount}
                    selectedWeapon={selectedWeapon}
                    setSelectedWeapon={setSelectedWeapon}
                    weaponCounts={weaponCounts}
                    nonWeaponTags={nonWeaponTags}
                    selectedTags={selectedTags}
                    toggleTag={toggleTag}
                    filtered={filtered}
                    resetFilters={resetFilters}
                />
            )}
        >
            <PageHeader
                className="hidden lg:block"
                title="Legends"
                actions={(
                    <>
                        <CountPills>
                            <CountPill label="Legends" value={liveCount} />
                            <CountPill label="Beta" value={betaCount} tone="amber" />
                            <CountPill label="Showing" value={filteredLegends.length} tone="blue" />
                        </CountPills>
                        <a href="/game/weapons" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">Weapon Chart</a>
                    </>
                )}
            >
                {newestLegend && <NewestLegend legend={newestLegend} />}
            </PageHeader>

            {newestLegend && (
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3 lg:hidden">
                    <h1 className="sr-only">Legends</h1>
                    <NewestLegend legend={newestLegend} />
                    <a href="/game/weapons" className="mt-2 inline-block text-sm font-bold text-blue-300 hover:underline">Weapon chart →</a>
                </div>
            )}

            {error && !data && <ErrorState message="Couldn't load the legend list." detail={error} onRetry={retry} />}

            {loading && !data && (
                <>
                    <LoadingState label="Loading legends…" />
                    <SkeletonGrid count={10} className="grid-cols-2 sm:gap-3 lg:grid-cols-4 2xl:grid-cols-5 min-[118.75rem]:grid-cols-6 min-[143.75rem]:grid-cols-7 min-[156.25rem]:grid-cols-8" tileClassName="h-80" />
                </>
            )}

            {data && !filteredLegends.length && (
                <EmptyState
                    title="No legends match these filters"
                    action={<button type="button" onClick={resetFilters} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">Clear filters</button>}
                />
            )}

            {data && !!filteredLegends.length && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-5 min-[118.75rem]:grid-cols-6 min-[143.75rem]:grid-cols-7 min-[156.25rem]:grid-cols-8">
                    {filteredLegends.map((item) => (
                        <LegendCard key={item.id || item.codeName || item.bio?.name?.normal} legend={item} />
                    ))}
                </div>
            )}
        </PageShell>
    );
}

export default LegendData;
