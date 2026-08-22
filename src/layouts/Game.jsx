import "../styles/global.css";
import { host } from '../stuff';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/20/solid';
import { Transition } from '@headlessui/react';
import '../../fonts/style.css';
import { SkinStoreView } from '../components/game/database/skin';
import { WeaponStoreView } from '../components/game/database/weapon';
import { ColorSchemeStoreView } from '../components/game/database/color';
import { EmojiStoreView } from "../components/game/database/emoji";
import {
  AvatarMetadataStoreView,
  BattlePassStoreView,
  BorderStoreView,
  BundleStoreView,
  ChestStoreView,
  CompanionMetadataStoreView,
  KOEffectMetadataStoreView,
  MetadataTypeView,
  PromoStoreView,
  PurchaseStoreView,
  RawMetadataView,
  PodiumMetadataStoreView,
  SkirmishStoreView,
  SmokeTrailMetadataStoreView,
  SpawnBotMetadataStoreView,
  TauntMetadataStoreView,
  TitlesMetadataStoreView,
  UIThemeMetadataStoreView,
} from "../components/game/database/metadata";
const defaultAnim = 'Animation_Unarmed/a__KickAnimation/Ready';
const fetchPostData = async (url, body, json) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed with ${res.status}`);
  if (json == true) return await res.json();
  return res;
};
const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
};
const NAV_PAGES = [
  'Skins',
  'Weapon Skins',
  'Colors',
  'Avatars',
  'Taunts',
  'Podiums',
  'UI Themes',
  'Borders',
  'Emojis',
  'Companions',
  'Sidekicks',
  'KO Effects',
  'Smoke Trails',
  'Titles',
  'Bundles',
  'Entitlements/Purchases',
  'Promo Rewards',
  'Chests',
  'Skirmishes',
  'Battle Passes',
  'Missions',
  'Achievements',
  'Tournament Events',
  'Splash Arts',
  'Music',
  'Helpful Hints',
  'Guild Missions',
  'Client Themes',
];

const STORE_DATA_SECTIONS = [
  { key: 'legends', label: 'Legends' },
  { key: 'skins', label: 'Skins' },
  { key: 'weapons', label: 'Weapon Skins' },
  { key: 'colors', label: 'Colors' },
  { key: 'avatars', label: 'Avatars' },
  { key: 'taunts', label: 'Taunts' },
  { key: 'podiums', label: 'Podiums' },
  { key: 'ui', label: 'UI Themes' },
  { key: 'emojis', label: 'Emojis' },
  { key: 'companions', label: 'Companions' },
  { key: 'spawnBots', label: 'Sidekicks' },
  { key: 'koeffects', label: 'KO Effects' },
  { key: 'smokeTrails', label: 'Smoke Trails' },
  { key: 'titles', label: 'Titles' },
  { key: 'bundles', label: 'Bundles' },
  { key: 'purchases', label: 'Entitlements/Purchases' },
  { key: 'promos', label: 'Promo Rewards' },
  { key: 'chests', label: 'Chests' },
  { key: 'skirmishes', label: 'Skirmishes' },
  { key: 'battlePasses', label: 'Battle Passes' },
  { key: 'borders', label: 'Borders' },
];

const STORE_DATA_LABELS = Object.fromEntries(STORE_DATA_SECTIONS.map((section) => [section.key, section.label]));
const STORE_SECTION_BY_PAGE = {
  'Skins': ['legends', 'skins'],
  'Weapon Skins': ['legends', 'weapons'],
  'Colors': ['colors', 'skins'],
  'Avatars': ['avatars'],
  'Taunts': ['taunts'],
  'Podiums': ['podiums'],
  'UI Themes': ['ui'],
  'Borders': ['borders'],
  'Emojis': ['emojis'],
  'Companions': ['companions'],
  'Sidekicks': ['spawnBots'],
  'KO Effects': ['koeffects'],
  'Smoke Trails': ['smokeTrails'],
  'Titles': ['titles'],
  'Bundles': ['bundles'],
  'Entitlements/Purchases': ['purchases'],
  'Promo Rewards': ['promos'],
  'Chests': ['chests'],
  'Skirmishes': ['skirmishes'],
  'Battle Passes': ['battlePasses'],
  'Missions': ['skins', 'podiums', 'promos'],
};

const pageSlug = (page) => String(page || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const PAGE_BY_SLUG = Object.fromEntries(NAV_PAGES.map((page) => [pageSlug(page), page]));

const selectionFromLocation = () => {
  if (typeof window === 'undefined') {
    return { category: 'Game Database', subcategory: 'Skins' };
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') === 'raw-metadata') {
    return { category: 'Raw Metadata', subcategory: null };
  }
  const page = PAGE_BY_SLUG[params.get('page') || ''];
  if (page) return { category: 'Game Database', subcategory: page };
  if (params.get('skin') || params.get('legend')) return { category: 'Game Database', subcategory: 'Skins' };
  if (params.get('taunt')) return { category: 'Game Database', subcategory: 'Taunts' };
  if (params.get('weapon')) return { category: 'Game Database', subcategory: 'Weapon Skins' };
  if (params.get('spawnbot')) return { category: 'Game Database', subcategory: 'Sidekicks' };
  if (params.get('color')) return { category: 'Game Database', subcategory: 'Colors' };
  if (params.get('koEffect') || params.get('koeffect')) return { category: 'Game Database', subcategory: 'KO Effects' };
  if (params.get('smoketrail') || params.get('smokeTrail')) return { category: 'Game Database', subcategory: 'Smoke Trails' };
  if (params.get('avatar')) return { category: 'Game Database', subcategory: 'Avatars' };
  if (params.get('podium')) return { category: 'Game Database', subcategory: 'Podiums' };
  return { category: 'Game Database', subcategory: 'Skins' };
};

function Spinner({ stage, completed = [], steps = [] }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-5 shadow-sm" style={{ fontFamily: 'BHLatinBold' }}>
        <div className="flex items-center gap-3">
          <div className="animate-pulse rounded-full h-10 w-10 bg-slate-500/40"></div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">Loading Game Database</div>
            <div className="text-sm text-blue-600 dark:text-blue-400">{stage || 'Preparing data requests...'}</div>
          </div>
        </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55dvh] overflow-y-auto app-scrollbar pr-1">
          {steps.map((step) => {
            const done = completed.includes(step);
            const active = stage === `Loading ${step}`;
            return (
              <div key={step} className="flex items-center justify-between rounded-lg bg-gray-100 dark:bg-slate-900 px-3 py-2 text-sm">
                <span className={done ? 'text-green-600 dark:text-green-400' : active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}>{step}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{done ? 'Loaded' : active ? 'Loading' : 'Queued'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function PromoCodesView() {
  return (
    <div className="text-gray-900 dark:text-white text-lg p-4 bg-gray-100 dark:bg-slate-900">
      <div>language types (IMPLEMENT EVERYWHERE)</div>
      <div>search query everything text related (weapons etc)</div>
      <div>map data (separate)</div>
      <div>animations</div>
      <div>battle pass</div>
      <div>color scheme creator revamp with new api</div>
      <div>massive legend data (animations, patch history, etc)</div>
      <div>achievements</div>
      <div>controller types</div>
      <div>ui themes per event</div>
      <div>color exceptions for color schemes</div>
      <div>dodge types</div>
      <div>gamemode types</div>
      <div>guild tags</div>
      <div>helpful hints (when loading int oa game)</div>
      <div>hurtboxes</div>
      <div>levelset types</div>
      <div>mission types</div>
      <div>quest types (battle pass quests?)</div>
      <div>skirmishes (+rewards)</div>
      <div>splash arts?</div>
      <div>stat types</div>
      <div>chests</div>
      <div>moniker titles</div>
      <div>player ui themes</div>
      <div>promo types (redeemable codes)</div>
      <div>season border types</div>
      <div>steam purchase types</div>
    </div>
  );
}
function TitlesView() {
  return <div className="text-gray-900 dark:text-white text-lg p-4 bg-gray-100 dark:bg-slate-900">Titles View Content Empty GO AWAY</div>;
}
export default function GameDatabase() {
  const initialSelection = selectionFromLocation();
  const [storeData, setStoreData] = useState({});
  const [metadataCatalog, setMetadataCatalog] = useState(null);
  const [langs, setLangs] = useState([]);
  const [selectedLang, setSelectedLang] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(initialSelection.category);
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialSelection.subcategory);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('Preparing data requests...');
  const [completedLoadingStages, setCompletedLoadingStages] = useState([]);
  const [loadingSteps, setLoadingSteps] = useState(['Languages', 'Metadata catalog', ...STORE_DATA_SECTIONS.map((section) => section.label)]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  const sidebarScrollRef = useRef(null);

  useEffect(() => {
    const applyUrlPage = () => {
      const selection = selectionFromLocation();
      setSelectedCategory(selection.category);
      setSelectedSubcategory(selection.subcategory);
    };
    applyUrlPage();
    window.addEventListener('popstate', applyUrlPage);
    return () => window.removeEventListener('popstate', applyUrlPage);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      setLoading(true);
      setLoadError('');
      setCompletedLoadingStages([]);
      setLoadingSteps(['Languages', 'Metadata catalog']);
      const fetchStoreSection = async (section) => {
        setLoadingStage(`Requesting ${section.label}`);
        const payload = await fetchJson(`${host}/game/storeData/${section.key}`);
        return payload;
      };
      try {
        setLoadingStage('Loading Languages');
        const langs = await fetchJson(`${host}/game/langs`);
        if (!alive) return;
        setCompletedLoadingStages((current) => [...current, 'Languages']);
        setLoadingStage('Loading Metadata catalog');
        const catalog = await fetchJson(`${host}/game/metadata/catalog`);
        if (!alive) return;
        setCompletedLoadingStages((current) => [...current, 'Metadata catalog']);
        setMetadataCatalog(catalog);
        setLangs(langs);
        const initialSections = STORE_SECTION_BY_PAGE[selectedSubcategory] || [];
        const nextStoreData = {};
        for (const key of initialSections) {
          const section = STORE_DATA_SECTIONS.find((candidate) => candidate.key === key);
          if (!section) continue;
          const payload = await fetchStoreSection(section);
          if (!alive) return;
          nextStoreData[section.key] = payload.items || [];
          setCompletedLoadingStages((current) => [...new Set([...current, section.label])]);
        }
        setStoreData(nextStoreData);
      } catch (err) {
        console.error(err);
        if (alive) setLoadError(err?.message || 'The game database could not be loaded.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadAll();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loading || selectedCategory !== 'Game Database') return;
    const required = STORE_SECTION_BY_PAGE[selectedSubcategory] || [];
    if (required.length === 0) {
      setPageLoading(false);
      setStoreData((current) => current.legends ? { legends: current.legends } : {});
      return;
    }
    const missing = required.filter((key) => !storeData[key]);
    if (missing.length === 0) {
      setPageLoading(false);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    setPageLoading(true);
    setLoadingSteps(required.map((key) => STORE_DATA_LABELS[key] || key));
    setCompletedLoadingStages(required.filter((key) => storeData[key]).map((key) => STORE_DATA_LABELS[key] || key));

    Promise.all(missing.map(async (key) => {
      const label = STORE_DATA_LABELS[key] || key;
      setLoadingStage(`Loading ${label}`);
      const response = await fetch(`${host}/game/storeData/${key}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`${label} failed with ${response.status}`);
      const payload = await response.json();
      if (alive) setCompletedLoadingStages((current) => [...new Set([...current, label])]);
      return [key, payload.items || []];
    })).then((loaded) => {
      if (!alive) return;
      setStoreData((current) => {
        const next = {};
        if (required.includes('legends') && current.legends) next.legends = current.legends;
        for (const [key, items] of loaded) next[key] = items;
        return next;
      });
    }).catch((error) => {
      if (error?.name !== 'AbortError') {
        console.error(error);
        if (alive) setLoadError(error?.message || 'The database section could not be loaded.');
      }
    }).finally(() => {
      if (alive) setPageLoading(false);
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [loading, selectedCategory, selectedSubcategory]);

  const requiredSections = STORE_SECTION_BY_PAGE[selectedSubcategory] || [];
  const missingPageData = selectedCategory === 'Game Database' && requiredSections.some((key) => !storeData[key]);
  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-slate-900">
        <div className="w-full max-w-lg rounded-xl border border-red-300 bg-white p-5 text-center dark:border-red-900 dark:bg-slate-800">
          <div className="text-lg font-bold text-gray-900 dark:text-white">Game Database Unavailable</div>
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">{loadError}</div>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500">
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (loading || pageLoading || missingPageData || langs.length === 0 || !metadataCatalog) {
    return <Spinner stage={loadingStage} completed={completedLoadingStages} steps={loadingSteps} />;
  }

  const handlePageChange = (category, subcategory = null) => {
    const scrollTop = sidebarScrollRef.current?.scrollTop ?? 0;
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    setIsMenuOpen(false);
    const params = new URLSearchParams();
    if (category === 'Game Database' && subcategory) params.set('page', pageSlug(subcategory));
    if (category === 'Raw Metadata') params.set('page', 'raw-metadata');
    const query = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    requestAnimationFrame(() => {
      if (sidebarScrollRef.current) sidebarScrollRef.current.scrollTop = scrollTop;
    });
  };

  const SidebarContent = () => (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">Game Database</div>
      </div>
      <select
        value={selectedLang}
        onChange={(e) => setSelectedLang(parseInt(e.target.value))}
        className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold rounded-lg px-3 py-2 border border-gray-300 dark:border-slate-600 w-full"
      >
        {langs.map((lang, idx) => (
          <option key={idx} value={idx}>{lang.name}</option>
        ))}
      </select>
      <div ref={sidebarScrollRef} className="space-y-1 pr-1">
        {NAV_PAGES.map((page) => {
          const active = selectedCategory === 'Game Database' && selectedSubcategory === page;
          return (
            <button
              key={page}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handlePageChange('Game Database', page)}
              className={`${active ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600'} flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition`}
            >
              <span>{page}</span>
              {active && <span className="h-2 w-2 rounded-full bg-white" />}
            </button>
          );
        })}
        <div className="h-1" />
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handlePageChange('Raw Metadata', null)}
          className={`${selectedCategory === 'Raw Metadata' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600'} w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition`}
        >
          Raw Metadata
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (selectedCategory === 'Game Database') {
      switch (selectedSubcategory) {
        case 'Skins':
          return <SkinStoreView skins={storeData.skins} legends={storeData.legends} langs={langs[selectedLang]} />;
        case 'Taunts':
          return <TauntMetadataStoreView taunts={storeData.taunts} langs={langs[selectedLang]} />;
        case 'Weapon Skins':
          return <WeaponStoreView weapons={storeData.weapons} legends={storeData.legends} langs={langs[selectedLang]} />;
        case 'Sidekicks':
          return <SpawnBotMetadataStoreView spawnbots={storeData.spawnBots} langs={langs[selectedLang]} />;
        case 'Colors':
          return <ColorSchemeStoreView colors={storeData.colors} skins={storeData.skins} langs={langs[selectedLang]} />;
        case 'KO Effects':
          return <KOEffectMetadataStoreView koEffects={storeData.koeffects} langs={langs[selectedLang]} />;
        case 'Smoke Trails':
          return <SmokeTrailMetadataStoreView smokeTrails={storeData.smokeTrails} langs={langs[selectedLang]} />;
        case 'Avatars':
          return <AvatarMetadataStoreView avatars={storeData.avatars} langs={langs[selectedLang]} />;
        case 'Podiums':
          return <PodiumMetadataStoreView podiums={storeData.podiums} langs={langs[selectedLang]} />;
        case 'UI Themes':
          return <UIThemeMetadataStoreView themes={storeData.ui} langs={langs[selectedLang]} />;
        case 'Borders':
          return <BorderStoreView borders={storeData.borders} langs={langs[selectedLang]} />;
        case 'Emojis':
          return <EmojiStoreView emojis={storeData.emojis} langs={langs[selectedLang]} />;
        case 'Companions':
          return <CompanionMetadataStoreView companions={storeData.companions} langs={langs[selectedLang]} />;
        case 'Titles':
          return <TitlesMetadataStoreView titles={storeData.titles} langs={langs[selectedLang]} />;
        case 'Bundles':
          return <BundleStoreView bundles={storeData.bundles} langs={langs[selectedLang]} />;
        case 'Entitlements/Purchases':
          return <PurchaseStoreView purchases={storeData.purchases} langs={langs[selectedLang]} />;
        case 'Promo Rewards':
          return <PromoStoreView promos={storeData.promos} langs={langs[selectedLang]} />;
        case 'Chests':
          return <ChestStoreView chests={storeData.chests} langs={langs[selectedLang]} />;
        case 'Skirmishes':
          return <SkirmishStoreView skirmishes={storeData.skirmishes} langs={langs[selectedLang]} />;
        case 'Battle Passes':
          return <BattlePassStoreView battlePasses={storeData.battlePasses} langs={langs[selectedLang]} />;
        case 'Missions':
          return <MetadataTypeView typeKey="missions" storeData={storeData} langs={langs[selectedLang]} />;
        case 'Achievements':
          return <MetadataTypeView typeKey="achievements" langs={langs[selectedLang]} />;
        case 'Tournament Events':
          return <MetadataTypeView typeKey="tournamentEvents" langs={langs[selectedLang]} />;
        case 'Splash Arts':
          return <MetadataTypeView typeKey="splashArts" langs={langs[selectedLang]} />;
        case 'Music':
          return <MetadataTypeView typeKey="music" langs={langs[selectedLang]} />;
        case 'Helpful Hints':
          return <MetadataTypeView typeKey="helpfulHints" langs={langs[selectedLang]} />;
        case 'Guild Missions':
          return <MetadataTypeView typeKey="guildMissions" langs={langs[selectedLang]} />;
        case 'Client Themes':
          return <MetadataTypeView typeKey="clientThemes" langs={langs[selectedLang]} />;
        default:
          return <div className="text-white text-sm italic p-4 bg-slate-900">Select a subcategory to view items.</div>;
      }
    }

    switch (selectedCategory) {
      case 'Raw Metadata':
        return <RawMetadataView catalog={metadataCatalog} />;
      default:
        return null;
    }
  };
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-white" style={{ fontFamily: langs[selectedLang]?.font || 'BHLatinBold' }}>
      <div className="lg:hidden sticky top-16 z-30 flex items-center justify-between bg-white/95 dark:bg-slate-800/95 px-4 py-3 shadow-sm backdrop-blur">
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">Game Database</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{selectedCategory}{selectedSubcategory ? ` / ${selectedSubcategory}` : ''}</div>
        </div>
        <button
          onClick={() => setIsMenuOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 p-2 text-gray-700 dark:text-gray-200"
        >
          <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/50" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation" />
          <aside className="relative h-full w-[min(92vw,24rem)] max-w-sm overflow-y-auto app-scrollbar bg-white dark:bg-slate-800 p-3 sm:p-4 shadow-xl">
            <button
              className="absolute right-3 top-3 rounded-lg bg-gray-100 dark:bg-slate-700 p-2 text-gray-700 dark:text-gray-200"
              onClick={() => setIsMenuOpen(false)}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] bg-gray-100 dark:bg-slate-900">
        <aside className="hidden lg:sticky lg:top-16 lg:z-20 lg:flex lg:w-72 lg:shrink-0 lg:self-start lg:flex-col bg-white dark:bg-slate-800 p-4 shadow-sm">
          <SidebarContent />
        </aside>
        <main className="min-w-0 bg-gray-100 dark:bg-slate-900">
          <div className="hidden bg-white/80 dark:bg-slate-800/80 px-4 py-3 shadow-sm backdrop-blur lg:block">
            <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">{selectedCategory}</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedSubcategory || selectedCategory}</h1>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
