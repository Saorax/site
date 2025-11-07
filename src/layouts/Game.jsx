import "../styles/global.css";
import { host } from '../stuff';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/20/solid';
import { Transition } from '@headlessui/react';
import '../../fonts/style.css';
import { SkinStoreView } from '../components/game/database/skin';
import { LegendStoreView } from '../components/game/database/legend';
import { TauntStoreView } from '../components/game/database/taunt';
import { WeaponStoreView } from '../components/game/database/weapon';
import { SpawnBotStoreView } from '../components/game/database/spawnbot';
import { ColorSchemeStoreView } from '../components/game/database/color';
import { KOEffectStoreView } from '../components/game/database/koeffect';
import { AvatarStoreView } from '../components/game/database/avatar';
import { PodiumStoreView } from '../components/game/database/podium';
import { UIThemeStoreView } from '../components/game/database/ui';
import { EmojiStoreView } from "../components/game/database/emoji";
import { CompanionStoreView } from "../components/game/database/companion";
import { TitlesStoreView } from "../components/game/database/moniker";
const defaultAnim = 'Animation_Unarmed/a__KickAnimation/Ready';
const fetchPostData = async (url, body, json) => {
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (json == true) return await res.json();
  return res;
};
function Spinner() {
  return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500 dark:border-gray-300"></div></div>;
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
  return <div className="text-gray-900 dark:text-white text-lg p-4 bg-gray-100 dark:bg-slate-900">Titles View Content</div>;
}
export default function GameDatabase() {
  const [storeData, setStoreData] = useState({});
  const [langs, setLangs] = useState([]);
  const [selectedLang, setSelectedLang] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("Store Data");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Legends");
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const categories = ['Store Data', 'Promo Codes', 'Titles'];
  const subcategories = {
    'Store Data': [
      'Legends', 'Skins', 'Weapon Skins', 'Avatars',
      'Taunts', 'Podiums', 'Player Themes', 'Emojis',
      'Companions', 'Sidekicks', 'KO Effect', 'Colors',
      'Titles','Bundles', 'Entitlements/Purchases', 'Chests', 'Skirmishes', ],
    'Titles': null,
    'Promo Codes': null,
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const legendId = params.get('legend');
    const skinId = params.get('skin');
    const tauntId = params.get('taunt');
    const weaponId = params.get('weapon');
    const spawnbotId = params.get('spawnbot');
    const colorId = params.get('color');
    const koEffectId = params.get('koeffect');
    const avatarId = params.get('avatar');
    const podiumId = params.get('podium');

    if (skinId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Skins');
    } else if (legendId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Legends');
    } else if (tauntId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Taunts');
    } else if (weaponId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Weapon Skins');
    } else if (spawnbotId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Sidekicks');
    } else if (colorId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Colors');
    } else if (koEffectId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('KO Effect');
    } else if (avatarId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Avatars');
    } else if (podiumId) {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Podiums');
    } else {
      setSelectedCategory('Store Data');
      setSelectedSubcategory('Legends');
      const newUrl = window.location.pathname;
      window.history.pushState({}, '', newUrl);
    }
  }, []);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const storeD = await fetch(`${host}/game/storeData`).then(res => res.json());
        const langs = await fetch(`${host}/game/langs`).then(res => res.json());
        setStoreData(storeD);
        console.log(storeD)
        setLangs(langs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  if (loading || langs.length === 0 || !storeData?.legends) {
    return <Spinner />;
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setIsMenuOpen(false);
    if (subcategories[category]) {
      setSelectedSubcategory(subcategories[category][0]);
    } else {
      setSelectedSubcategory(null);
    }
    const newUrl = window.location.pathname;
    window.history.pushState({}, '', newUrl);
  };

  const handleSubcategoryChange = (subcategory) => {
    setSelectedSubcategory(subcategory);
    setIsMenuOpen(false);
    const newUrl = window.location.pathname;
    window.history.pushState({}, '', newUrl);
  };
  const renderContent = () => {
    if (selectedCategory === 'Store Data') {
      switch (selectedSubcategory) {
        case 'Legends':
          return <LegendStoreView legends={storeData.legends} langs={langs[selectedLang]} />;
        case 'Skins':
          return <SkinStoreView skins={storeData.skins} legends={storeData.legends} langs={langs[selectedLang]} />;
        case 'Taunts':
          return <TauntStoreView taunts={storeData.taunts} langs={langs[selectedLang]} />;
        case 'Weapon Skins':
          return <WeaponStoreView weapons={storeData.weapons} legends={storeData.legends} langs={langs[selectedLang]} />;
        case 'Sidekicks':
          return <SpawnBotStoreView spawnbots={storeData.spawnBots} langs={langs[selectedLang]} />;
        case 'Colors':
          return <ColorSchemeStoreView colors={storeData.colors} langs={langs[selectedLang]} />;
        case 'KO Effect':
          return <KOEffectStoreView koEffects={storeData.koeffects} langs={langs[selectedLang]} />;
        case 'Avatars':
          return <AvatarStoreView avatars={storeData.avatars} langs={langs[selectedLang]} />;
        case 'Podiums':
          return <PodiumStoreView podiums={storeData.podiums} langs={langs[selectedLang]} />;
        case 'Player Themes':
          return <UIThemeStoreView themes={storeData.ui} langs={langs[selectedLang]} />;
        case 'Emojis':
          return <EmojiStoreView emojis={storeData.emojis} langs={langs[selectedLang]} />;
        case 'Companions':
          return <CompanionStoreView companions={storeData.companions} langs={langs[selectedLang]} />;
        case 'Titles':
          return <TitlesStoreView titles={storeData.titles} langs={langs[selectedLang]} />;
        case 'Bundles':
        case 'Entitlements/Purchases':
        case 'Chests':
        default:
          return <div className="text-white text-sm italic p-4 bg-slate-900">Select a subcategory to view items.</div>;
      }
    }

    switch (selectedCategory) {
      case 'Promo Codes':
        return <PromoCodesView />;
      case 'Titles':
        return <TitlesView />;
      default:
        return null;
    }
  };
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900">
      <nav className="bg-white dark:bg-slate-800 shadow">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">Game Database</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryChange(category)}
                    className={`${selectedCategory === category
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-100'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(parseInt(e.target.value))}
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-2 py-1 border border-gray-300 dark:border-slate-600"
              >
                {langs.map((lang, idx) => (
                  <option key={idx} value={idx}>{lang.name}</option>
                ))}
              </select>
            </div>
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none"
              >
                <span className="sr-only">Open main menu</span>
                {isMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
        {isMenuOpen && (
          <div className="sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`${selectedCategory === category
                    ? 'bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-100'
                    } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200 dark:border-slate-600">
              <div className="px-2">
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(parseInt(e.target.value))}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-2 py-1 border border-gray-300 dark:border-slate-600 w-full"
                >
                  {langs.map((lang, idx) => (
                    <option key={idx} value={idx}>{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </nav>
      {selectedCategory === 'Store Data' && subcategories['Store Data'] && (
        <div className="bg-white dark:bg-slate-800 shadow">
          <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-wrap gap-2">
              {subcategories['Store Data'].map((subcategory) => (
                <button
                  key={subcategory}
                  onClick={() => handleSubcategoryChange(subcategory)}
                  className={`${selectedSubcategory === subcategory
                    ? 'bg-blue-500 dark:bg-blue-400 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'
                    } px-4 py-2 rounded-md text-sm font-medium`}
                >
                  {subcategory}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div>
        {renderContent()}
      </div>
    </div>
  );
}