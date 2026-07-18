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
    body: JSON.stringify(body)
  });
  if (json == true) return await res.json();
  return res;
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

const pageSlug = (page) => String(page || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const PAGE_BY_SLUG = Object.fromEntries(NAV_PAGES.map((page) => [pageSlug(page), page]));

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
  const [storeData, setStoreData] = useState({});
  const [metadataCatalog, setMetadataCatalog] = useState(null);
  const [langs, setLangs] = useState([]);
  const [selectedLang, setSelectedLang] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("Game Database");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Skins");
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Preparing data requests...');
  const [completedLoadingStages, setCompletedLoadingStages] = useState([]);
  const [loadingSteps, setLoadingSteps] = useState(['Languages', 'Metadata catalog', ...STORE_DATA_SECTIONS.map((section) => section.label)]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const sidebarScrollRef = useRef(null);

  useEffect(() => {
    const applyUrlPage = () => {
      const params = new URLSearchParams(window.location.search);
      const rawPageParam = params.get('page') === 'raw-metadata';
      const pageParam = PAGE_BY_SLUG[params.get('page') || ''];
      const legendId = params.get('legend');
      const skinId = params.get('skin');
      const tauntId = params.get('taunt');
      const weaponId = params.get('weapon');
      const spawnbotId = params.get('spawnbot');
      const colorId = params.get('color');
      const koEffectId = params.get('koEffect') || params.get('koeffect');
      const smokeTrailId = params.get('smoketrail') || params.get('smokeTrail');
      const avatarId = params.get('avatar');
      const podiumId = params.get('podium');

      if (rawPageParam) {
        setSelectedCategory('Raw Metadata');
        setSelectedSubcategory(null);
      } else if (pageParam) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory(pageParam);
      } else if (skinId || legendId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Skins');
      } else if (tauntId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Taunts');
      } else if (weaponId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Weapon Skins');
      } else if (spawnbotId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Sidekicks');
      } else if (colorId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Colors');
      } else if (koEffectId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('KO Effects');
      } else if (smokeTrailId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Smoke Trails');
      } else if (avatarId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Avatars');
      } else if (podiumId) {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Podiums');
      } else {
        setSelectedCategory('Game Database');
        setSelectedSubcategory('Skins');
      }
    };
    applyUrlPage();
    window.addEventListener('popstate', applyUrlPage);
    return () => window.removeEventListener('popstate', applyUrlPage);
  }, []);

  useEffect(() => {
    let alive = true;
    let polling = true;
    let statusTimer = null;

    async function loadAll() {
      setLoading(true);
      setCompletedLoadingStages([]);
      setLoadingSteps(['Languages', 'Metadata catalog', ...STORE_DATA_SECTIONS.map((section) => section.label)]);
      const syncStoreStatus = async () => {
        if (!alive) return;
        try {
          const status = await fetch(`${host}/game/storeData/status`).then(res => res.json());
          if (!alive) return;
          const releaseIndex = status?.releaseIndex;
          if (releaseIndex?.state && !['idle', 'ready'].includes(releaseIndex.state)) {
            const total = Number(releaseIndex.total || 0);
            const current = Number(releaseIndex.current || 0);
            const progress = total > 0 ? ` (${current}/${total})` : '';
            const patch = releaseIndex.currentPatch ? ` · ${releaseIndex.currentPatch}` : '';
            setLoadingStage(`${releaseIndex.stage || 'Indexing item release patches'}${progress}${patch}`);
          } else if (status?.stage) {
            setLoadingStage(status.stage);
          }
          if (Array.isArray(status?.completedSections)) {
            setCompletedLoadingStages((current) => {
              const base = current.filter((step) => step === 'Languages' || step === 'Metadata catalog');
              const completed = status.completedSections.map((key) => STORE_DATA_LABELS[key] || key);
              return [...new Set([...base, ...completed])];
            });
          }
        } catch (error) {
          console.error(error);
        }
      };
      const scheduleStatusPoll = () => {
        if (!polling || !alive) return;
        statusTimer = window.setTimeout(async () => {
          await syncStoreStatus();
          scheduleStatusPoll();
        }, 1000);
      };
      const fetchStoreSection = async (section) => {
        setLoadingStage(`Requesting ${section.label}`);
        const payload = await fetch(`${host}/game/storeData/${section.key}`).then(res => res.json());
        await syncStoreStatus();
        return payload;
      };
      try {
        scheduleStatusPoll();
        setLoadingStage('Loading Languages');
        const langs = await fetch(`${host}/game/langs`).then(res => res.json());
        if (!alive) return;
        setCompletedLoadingStages((current) => [...current, 'Languages']);
        setLoadingStage('Loading Metadata catalog');
        const catalog = await fetch(`${host}/game/metadata/catalog`).then(res => res.json());
        if (!alive) return;
        setCompletedLoadingStages((current) => [...current, 'Metadata catalog']);
        setMetadataCatalog(catalog);
        setLangs(langs);
        const nextStoreData = {};
        for (const section of STORE_DATA_SECTIONS) {
          const payload = await fetchStoreSection(section);
          if (!alive) return;
          nextStoreData[section.key] = payload.items || [];
          setStoreData((current) => ({ ...current, [section.key]: payload.items || [] }));
          setCompletedLoadingStages((current) => [...new Set([...current, section.label])]);
        }
        setStoreData(nextStoreData);
      } catch (err) {
        console.error(err);
      } finally {
        polling = false;
        if (statusTimer) window.clearTimeout(statusTimer);
        if (alive) setLoading(false);
      }
    }
    loadAll();
    return () => {
      alive = false;
      polling = false;
      if (statusTimer) window.clearTimeout(statusTimer);
    };
  }, []);

  if (loading || langs.length === 0 || !storeData?.legends || !metadataCatalog) {
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
    <div className="flex h-full flex-col gap-4">
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
      <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto app-scrollbar overscroll-contain pr-1 space-y-1">
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
          return <ColorSchemeStoreView colors={storeData.colors} langs={langs[selectedLang]} />;
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
          return <MetadataTypeView typeKey="missions" langs={langs[selectedLang]} />;
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
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-white/95 dark:bg-slate-800/95 px-4 py-3 shadow-sm backdrop-blur">
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
        <div className="fixed inset-0 z-50 lg:hidden">
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
        <aside className="hidden lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-dvh lg:w-72 lg:shrink-0 lg:flex-col bg-white dark:bg-slate-800 p-4 shadow-sm overflow-hidden">
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
