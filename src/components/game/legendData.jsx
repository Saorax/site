import { useEffect, useMemo, useState } from 'react';
import { host } from "../../stuff";

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
    "Bow", "Fists", "Scythe", "Cannon", "Orb", "Greatsword", "Boots",
];

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

function statTotal(legend) {
    return statRows.reduce((total, row) => total + statValue(legend, row.key), 0);
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

function legendUrl(legend) {
    return `/game/legends/${normalizeString(legend?.bio?.name?.normal)}`;
}

function sortLegends(items, sortBy) {
    const byName = (a, b) => String(a?.bio?.name?.normal || '').localeCompare(String(b?.bio?.name?.normal || ''));
    const byReleaseAsc = (a, b) => {
        const aRelease = releaseMs(a.release);
        const bRelease = releaseMs(b.release);
        if (!aRelease && !bRelease) return byName(a, b);
        if (!aRelease) return 1;
        if (!bRelease) return -1;
        return aRelease - bRelease || byName(a, b);
    };
    const byReleaseDesc = (a, b) => {
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
                                    className="h-5 w-4 shrink-0 object-fill"
                                    alt=""
                                    aria-hidden="true"
                                />
                            ))}
                        </div>
                        <span className="text-right text-xs font-black text-slate-700 dark:text-slate-100">{value}</span>
                    </div>
                );
            })}
        </div>
    );
}

function SummaryTile({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="text-lg font-black leading-none text-slate-950 dark:text-white">{value}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
        </div>
    );
}

function LegendCard({ legend }) {
    const beta = isBetaLegend(legend);
    const aka = String(legend?.bio?.aka || '').split(', ')[0];

    return (
        <a
            href={legendUrl(legend)}
            className="group relative flex min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-blue-500/20 to-transparent dark:from-blue-400/10" />

            <div className="relative flex items-start justify-between gap-2 p-3 pb-1">
                <div className="min-w-0">
                    <div className="truncate text-[11px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">
                        {aka || legend?.codeName || 'Legend'}
                    </div>
                    <h2 className="mt-0.5 break-words text-xl font-black leading-none tracking-tight sm:text-2xl">
                        {legend?.bio?.name?.normal}
                    </h2>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-right text-[10px] font-black leading-tight text-slate-700 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100">
                        {releaseDate(legend.release)}
                    </span>
                    {beta && (
                        <span className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-200">
                            Beta
                        </span>
                    )}
                </div>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-start px-3">
                <div className="grid w-full grid-cols-[4.5rem_1fr] items-center gap-3">
                    <div className="flex flex-col items-center gap-2">
                        {legend?.weapons?.main?.image && <img src={apiAsset(legend.weapons.main.image)} className="h-16 w-16 object-contain drop-shadow" alt={`${legend.weapons.main.name}`} />}
                        {legend?.weapons?.secondary?.image && <img src={apiAsset(legend.weapons.secondary.image)} className="h-16 w-16 object-contain drop-shadow" alt={`${legend.weapons.secondary.name}`} />}
                    </div>

                    <div className="flex h-36 items-end justify-center rounded-2xl bg-slate-100/80 p-2 dark:bg-slate-950/45">
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

function FilterButton({ active, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${active ? 'border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'border-slate-300 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:bg-slate-700'} rounded-xl border px-3 py-2 text-sm font-black transition`}
        >
            {children}
        </button>
    );
}

function LegendData() {
    const [historyItems, setHistoryItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedWeapon, setSelectedWeapon] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [showBetaLegends, setShowBetaLegends] = useState(false);
    const [sortBy, setSortBy] = useState('releaseAsc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(host + '/game/legends/summary');
                if (!response.ok) throw new Error(`Failed to load legends (${response.status})`);
                const data = await response.json();
                if (!cancelled) setHistoryItems(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchData();
        return () => {
            cancelled = true;
        };
    }, []);

    const betaCount = useMemo(() => historyItems.filter(isBetaLegend).length, [historyItems]);
    const liveCount = historyItems.length - betaCount;
    const visiblePool = useMemo(() => historyItems.filter((item) => showBetaLegends || !isBetaLegend(item)), [historyItems, showBetaLegends]);

    const nonWeaponTags = useMemo(() => Array.from(
        new Set(
            visiblePool.flatMap(item => item.missionTagsFull || [])
                .filter(tag => tag && !weaponList.includes(tag))
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
                || weaponNames(item).some((weapon) => normalizeString(weapon).includes(searchQuery));

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
        setSelectedTags((prevTags) =>
            prevTags.includes(tag) ? prevTags.filter(t => t !== tag) : [...prevTags, tag]
        );
    };

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedWeapon(null);
        setSelectedTags([]);
        setSortBy('releaseAsc');
    };

    return (
        <div className="min-h-screen bg-slate-100 p-3 text-slate-950 dark:bg-slate-950 dark:text-white sm:p-4">
            <div className="mx-auto flex max-w-[100rem] flex-col gap-4">
                <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
                        <div>
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Legend Database</div>
                            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Brawlhalla Legends</h1>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:min-w-96">
                            <SummaryTile label="Live" value={liveCount} />
                            <SummaryTile label="Beta" value={betaCount} />
                            <SummaryTile label="Showing" value={filteredLegends.length} />
                        </div>
                    </div>

                    {newestLegend && (
                        <div className="border-t border-slate-200 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent px-4 py-3 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                                <span className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">Newest</span>
                                {newestLegend.image && <img src={apiAsset(newestLegend.image)} className="h-10 w-10 rounded-lg object-contain" alt={newestLegend.bio?.name?.normal} />}
                                <span className="text-slate-950 dark:text-white">{newestLegend.bio?.name?.normal}</span>
                                <span>{releaseDate(newestLegend.release)}</span>
                                <span>{weaponNames(newestLegend).join(' / ')}</span>
                            </div>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_14rem_auto]">
                        <input
                            type="text"
                            placeholder="Search legends, codenames, aliases, or weapons"
                            className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        >
                            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-black text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                            <input
                                type="checkbox"
                                checked={showBetaLegends}
                                onChange={(e) => setShowBetaLegends(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                            />
                            Show Beta
                        </label>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {weaponList.map((weapon) => (
                            <button
                                key={weapon}
                                type="button"
                                className={`${selectedWeapon === weapon ? 'border-blue-400 bg-blue-500/15 text-blue-700 dark:text-blue-200' : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'} flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-black transition`}
                                onClick={() => setSelectedWeapon(selectedWeapon === weapon ? null : weapon)}
                            >
                                <img src={weaponIcon(weapon)} alt={weapon} className="h-7 w-7 object-contain" />
                                <span>{weapon}</span>
                                <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">{weaponCounts.get(weapon) || 0}</span>
                            </button>
                        ))}
                    </div>

                    {!!nonWeaponTags.length && (
                        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 open:space-y-3 dark:border-slate-800 dark:bg-slate-950/70">
                            <summary className="cursor-pointer select-none text-sm font-black text-slate-700 dark:text-slate-200">
                                Archetype Tags {selectedTags.length > 0 ? `(${selectedTags.length} selected)` : ''}
                            </summary>
                            <div className="flex flex-wrap gap-2">
                                {nonWeaponTags.map((tag) => (
                                    <FilterButton key={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)}>
                                        {tag}
                                    </FilterButton>
                                ))}
                            </div>
                        </details>
                    )}

                    {(searchTerm || selectedWeapon || selectedTags.length || sortBy !== 'releaseAsc') && (
                        <div className="mt-3 flex justify-center">
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white transition hover:bg-red-400"
                            >
                                Reset Filters
                            </button>
                        </div>
                    )}
                </section>

                {loading && (
                    <div className="rounded-2xl border border-slate-300 bg-white p-8 text-center text-lg font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        Loading legends...
                    </div>
                )}

                {!!error && (
                    <div className="rounded-2xl border border-red-400/50 bg-red-500/10 p-4 text-center font-bold text-red-700 dark:text-red-200">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                        {filteredLegends.map((item) => (
                            <LegendCard key={item.id || item.codeName || item.bio?.name?.normal} legend={item} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LegendData;
