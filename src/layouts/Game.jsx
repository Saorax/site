import "../styles/global.css";
import { host } from '../stuff';
import { useState, useEffect } from 'react';
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
import { DataViewToggle, EmptyState, ErrorState, LoadingState, PageHeader, PageShell, SelectInput, SidebarHeader, SidebarItem, Spinner, cx } from '../components/ui';
import { NAV_GROUPS, RAW_METADATA, databasePageTitle, pageSlug, selectionFromParams } from '../components/game/database/pages';
import { pageTitle } from '../data/head';

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
};

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
const STORE_SECTION_QUERY = { legends: '?omit=skins,weapons' };
const LANGUAGE_KEY = 'database-language';

const storedLanguage = () => {
  try {
    const value = Number.parseInt(window.localStorage.getItem(LANGUAGE_KEY) || '0', 10);
    return Number.isInteger(value) && value >= 0 && value < 13 ? value : 0;
  } catch {
    return 0;
  }
};

const rememberLanguage = (value) => {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, String(value));
  } catch {}
};
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

const selectionFromLocation = () => (typeof window === 'undefined'
  ? { category: 'Game Database', subcategory: 'Skins' }
  : selectionFromParams(new URLSearchParams(window.location.search)));

function LoadingSteps({ steps = [] }) {
  const pending = steps.filter((step) => !step.done).map((step) => step.label);
  return (
    <div className="space-y-3">
      <LoadingState label={pending.length ? `Loading ${pending.join(', ')}…` : 'Loading…'} />
      {steps.length > 1 && (
        <ul className="grid max-w-5xl grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
              <span className={step.done ? 'text-emerald-200' : 'text-blue-200'}>{step.label}</span>
              <span className="text-xs text-slate-500">{step.done ? 'Loaded' : 'Loading'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function GameDatabase() {
  const initialSelection = selectionFromLocation();
  const [storeData, setStoreData] = useState({});
  const [metadataCatalog, setMetadataCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [languages, setLanguages] = useState([]);
  const [languageCache, setLanguageCache] = useState({});
  const [selectedLang, setSelectedLang] = useState(storedLanguage);
  const [shownLang, setShownLang] = useState(null);
  const [langError, setLangError] = useState('');
  const [langAttempt, setLangAttempt] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(initialSelection.category);
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialSelection.subcategory);
  const [pageLoading, setPageLoading] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [sectionAttempt, setSectionAttempt] = useState(0);

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
    fetchJson(`${host}/game/languages`)
      .then((list) => {
        if (alive && Array.isArray(list)) setLanguages(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (languageCache[selectedLang]) {
      setShownLang(selectedLang);
      setLangError('');
      return;
    }
    let alive = true;
    const controller = new AbortController();
    setLangError('');
    fetchJson(`${host}/game/langs/${selectedLang}`, { signal: controller.signal })
      .then((payload) => {
        const record = Array.isArray(payload) ? payload[0] : null;
        if (!record?.content) throw new Error("The game text file is empty.");
        if (!alive) return;
        setLanguageCache((current) => ({ ...current, [selectedLang]: record }));
        setShownLang(selectedLang);
      })
      .catch((error) => {
        if (!alive || error?.name === 'AbortError') return;
        console.error(error);
        setLangError(error?.message || "Couldn't load the game text.");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [selectedLang, langAttempt]);

  useEffect(() => {
    if (selectedCategory !== RAW_METADATA || metadataCatalog) return;
    let alive = true;
    setCatalogError('');
    fetchJson(`${host}/game/metadata/catalog`)
      .then((catalog) => {
        if (alive) setMetadataCatalog(catalog);
      })
      .catch((error) => {
        if (!alive) return;
        console.error(error);
        setCatalogError(error?.message || "Couldn't load the file list.");
      });
    return () => {
      alive = false;
    };
  }, [selectedCategory, catalogAttempt]);

  useEffect(() => {
    if (selectedCategory !== 'Game Database') return;
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
    setSectionError('');

    Promise.all(missing.map(async (key) => {
      const label = STORE_DATA_LABELS[key] || key;
      const response = await fetch(`${host}/game/storeData/${key}${STORE_SECTION_QUERY[key] || ''}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`${label} failed with ${response.status}`);
      const payload = await response.json();
      const items = payload.items || [];
      if (alive) setStoreData((current) => ({ ...current, [key]: items }));
      return [key, items];
    })).then((loaded) => {
      if (!alive) return;
      setStoreData((current) => {
        const next = {};
        for (const key of required) {
          if (current[key]) next[key] = current[key];
        }
        for (const [key, items] of loaded) next[key] = items;
        return next;
      });
    }).catch((error) => {
      if (error?.name !== 'AbortError') {
        console.error(error);
        if (alive) setSectionError(error?.message || "Couldn't load this section.");
      }
    }).finally(() => {
      if (alive) setPageLoading(false);
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [selectedCategory, selectedSubcategory, sectionAttempt]);

  const lang = shownLang === null ? null : languageCache[shownLang];

  const retry = () => {
    if (langError) {
      setLangError('');
      setLangAttempt((current) => current + 1);
    }
    if (sectionError) {
      setSectionError('');
      setSectionAttempt((current) => current + 1);
    }
    if (catalogError) {
      setCatalogError('');
      setCatalogAttempt((current) => current + 1);
    }
  };

  const changeLanguage = (value) => {
    const next = Number.parseInt(value, 10);
    if (!Number.isInteger(next)) return;
    setSelectedLang(next);
    rememberLanguage(next);
  };

  const handlePageChange = (category, subcategory = null, close) => {
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    setSectionError('');
    close?.();
    const params = new URLSearchParams();
    if (category === 'Game Database' && subcategory) params.set('page', pageSlug(subcategory));
    if (category === RAW_METADATA) params.set('page', 'raw-metadata');
    const query = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  };

  useEffect(() => {
    document.title = pageTitle(databasePageTitle({ category: selectedCategory, subcategory: selectedSubcategory }));
  }, [selectedCategory, selectedSubcategory]);

  const currentPage = selectedCategory === RAW_METADATA ? RAW_METADATA : selectedSubcategory;
  const languageOptions = languages.length
    ? languages.map((language) => ({ value: language.id, label: language.name }))
    : lang ? [{ value: shownLang, label: lang.name }] : [];
  const pendingLanguage = selectedLang !== shownLang
    ? (languages.find((language) => language.id === selectedLang)?.name || 'language')
    : null;

  const sidebar = ({ close }) => (
    <div className="flex flex-col gap-3">
      <SidebarHeader as="div" title="Game Database" />
      {languageOptions.length > 0 && (
        <div className="space-y-1.5">
          <SelectInput
            label="Language"
            value={selectedLang}
            onChange={changeLanguage}
            options={languageOptions}
          />
          {lang && pendingLanguage && !langError && (
            <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
              <Spinner className="h-3.5 w-3.5" />
              Loading {pendingLanguage}…
            </div>
          )}
          {lang && langError && (
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-rose-300">
              <span>Couldn't load {pendingLanguage || 'that language'}.</span>
              <button type="button" onClick={retry} className="rounded-lg border border-slate-600 px-2 py-1 font-bold text-slate-100 hover:border-blue-400">Retry</button>
            </div>
          )}
        </div>
      )}
      <nav aria-label="Database sections" className="space-y-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-blue-300">{group.title}</div>
            <div className="space-y-1">
              {group.pages.map((page) => {
                const isRaw = page === RAW_METADATA;
                const active = isRaw ? selectedCategory === RAW_METADATA : selectedCategory === 'Game Database' && selectedSubcategory === page;
                return (
                  <SidebarItem
                    key={page}
                    active={active}
                    onClick={() => handlePageChange(isRaw ? RAW_METADATA : 'Game Database', isRaw ? null : page, close)}
                    className={cx('px-3 py-2 text-sm font-bold', active ? 'text-white' : 'text-slate-200')}
                  >
                    {page}
                  </SidebarItem>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  const requiredSections = selectedCategory === 'Game Database' ? (STORE_SECTION_BY_PAGE[selectedSubcategory] || []) : [];
  const missingPageData = requiredSections.some((key) => !storeData[key]);
  const needsCatalog = selectedCategory === RAW_METADATA;
  const busy = !lang || pageLoading || missingPageData || (needsCatalog && !metadataCatalog);
  const loadingSteps = [
    { label: 'Language', done: !!lang },
    ...requiredSections.map((key) => ({ label: STORE_DATA_LABELS[key] || key, done: !!storeData[key] })),
    ...(needsCatalog ? [{ label: 'File list', done: !!metadataCatalog }] : []),
  ];
  const pageError = !lang && langError
    ? { message: "Couldn't load the database.", detail: langError }
    : sectionError
      ? { message: "Couldn't load this section.", detail: sectionError }
      : needsCatalog && catalogError
        ? { message: "Couldn't load the game file list.", detail: catalogError }
        : null;

  const renderContent = () => {
    if (selectedCategory === 'Game Database') {
      switch (selectedSubcategory) {
        case 'Skins':
          return <SkinStoreView skins={storeData.skins} legends={storeData.legends} langs={lang} />;
        case 'Taunts':
          return <TauntMetadataStoreView taunts={storeData.taunts} langs={lang} />;
        case 'Weapon Skins':
          return <WeaponStoreView weapons={storeData.weapons} legends={storeData.legends} langs={lang} />;
        case 'Sidekicks':
          return <SpawnBotMetadataStoreView spawnbots={storeData.spawnBots} langs={lang} />;
        case 'Colors':
          return <ColorSchemeStoreView colors={storeData.colors} skins={storeData.skins} langs={lang} />;
        case 'KO Effects':
          return <KOEffectMetadataStoreView koEffects={storeData.koeffects} langs={lang} />;
        case 'Smoke Trails':
          return <SmokeTrailMetadataStoreView smokeTrails={storeData.smokeTrails} langs={lang} />;
        case 'Avatars':
          return <AvatarMetadataStoreView avatars={storeData.avatars} langs={lang} />;
        case 'Podiums':
          return <PodiumMetadataStoreView podiums={storeData.podiums} langs={lang} />;
        case 'UI Themes':
          return <UIThemeMetadataStoreView themes={storeData.ui} langs={lang} />;
        case 'Borders':
          return <BorderStoreView borders={storeData.borders} langs={lang} />;
        case 'Emojis':
          return <EmojiStoreView emojis={storeData.emojis} langs={lang} />;
        case 'Companions':
          return <CompanionMetadataStoreView companions={storeData.companions} langs={lang} />;
        case 'Titles':
          return <TitlesMetadataStoreView titles={storeData.titles} langs={lang} />;
        case 'Bundles':
          return <BundleStoreView bundles={storeData.bundles} langs={lang} />;
        case 'Entitlements/Purchases':
          return <PurchaseStoreView purchases={storeData.purchases} langs={lang} />;
        case 'Promo Rewards':
          return <PromoStoreView promos={storeData.promos} langs={lang} />;
        case 'Chests':
          return <ChestStoreView chests={storeData.chests} langs={lang} />;
        case 'Skirmishes':
          return <SkirmishStoreView skirmishes={storeData.skirmishes} langs={lang} />;
        case 'Battle Passes':
          return <BattlePassStoreView battlePasses={storeData.battlePasses} langs={lang} />;
        case 'Missions':
          return <MetadataTypeView typeKey="missions" storeData={storeData} langs={lang} />;
        case 'Achievements':
          return <MetadataTypeView typeKey="achievements" langs={lang} />;
        case 'Tournament Events':
          return <MetadataTypeView typeKey="tournamentEvents" langs={lang} />;
        case 'Splash Arts':
          return <MetadataTypeView typeKey="splashArts" langs={lang} />;
        case 'Music':
          return <MetadataTypeView typeKey="music" langs={lang} />;
        case 'Helpful Hints':
          return <MetadataTypeView typeKey="helpfulHints" langs={lang} />;
        case 'Guild Missions':
          return <MetadataTypeView typeKey="guildMissions" langs={lang} />;
        case 'Client Themes':
          return <MetadataTypeView typeKey="clientThemes" langs={lang} />;
        default:
          return <EmptyState title="Pick a section" />;
      }
    }
    if (selectedCategory === RAW_METADATA) return <RawMetadataView catalog={metadataCatalog} />;
    return null;
  };

  return (
    <div style={{ fontFamily: lang?.font || 'BHLatinBold' }}>
      <PageShell
        title="Game Database"
        sidebar={sidebar}
        sidebarLabel="Sections"
        sidebarTitle="Game Database sections"
      >
        <PageHeader
          title={currentPage || 'Store & Cosmetics'}
          actions={<DataViewToggle />}
        />
        {pageError ? (
          <ErrorState message={pageError.message} detail={pageError.detail} onRetry={retry} />
        ) : busy ? (
          <LoadingSteps steps={loadingSteps} />
        ) : (
          renderContent()
        )}
      </PageShell>
    </div>
  );
}
