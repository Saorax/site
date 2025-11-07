import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/20/solid';
import { Transition } from '@headlessui/react';
import { Pagination } from './comp/pagination';
import { SvgArrayFlipbook } from './comp/svg';

const splitTags = (tags) => {
  if (!tags) return [];
  const result = [];
  let buffer = '';
  let insideQuotes = false;
  for (let char of tags) {
    if (char === "'") insideQuotes = !insideQuotes;
    if (char === ',' && !insideQuotes) {
      result.push(buffer.trim().replace(/^'+|'+$/g, ''));
      buffer = '';
    } else {
      buffer += char;
    }
  }
  if (buffer.length > 0) result.push(buffer.trim().replace(/^'+|'+$/g, ''));
  return result;
};
export function LegendStoreView({ legends, langs }) {
  const [selectedLegend, setSelectedLegend] = useState(null);
  const [currentAnimation, setCurrentAnimation] = useState('Idle');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortType, setSortType] = useState('ReleaseAsc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const itemsPerPage = 30;
  const topRef = useRef(null);

  // Handle initial legend selection and pagination
  useEffect(() => {
    if (legends.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const heroID = params.get('legend') ? parseInt(params.get('legend'), 10) : null;

    let legend = null;
    if (heroID) {
      legend = legends.find(l => l.heroData.HeroID == heroID);
    }
    if (!legend) {
      legend = legends[0];
    }

    setSelectedLegend(legend);
    setIsDetailOpen(!!heroID);

    // Calculate the page for the selected legend
    const filteredLegends = legends
      .filter((l) => {
        if (!langs?.content) return true;
        const name = langs.content[l.DisplayNameKey] || '';
        const storeName = l.StoreName || '';
        const itemName = l.Item || '';
        return (
          name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          itemName.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
      .sort((a, b) => {
        switch (sortType) {
          case 'ReleaseAsc': return a.heroData.ReleaseOrderID - b.heroData.ReleaseOrderID;
          case 'ReleaseDesc': return b.heroData.ReleaseOrderID - a.heroData.ReleaseOrderID;
          case 'SkinsAsc': return (a.skins?.length || 0) - (b.skins?.length || 0);
          case 'SkinsDesc': return (b.skins?.length || 0) - (a.skins?.length || 0);
          case 'GoldAsc': return parseFloat(a.GoldCost) - parseFloat(b.GoldCost);
          case 'GoldDesc': return parseFloat(b.GoldCost) - parseFloat(a.GoldCost);
          case 'AlphaAsc': return (langs.content[a.DisplayNameKey] || '').localeCompare(langs.content[b.DisplayNameKey] || '');
          case 'AlphaDesc': return (langs.content[b.DisplayNameKey] || '').localeCompare(langs.content[a.DisplayNameKey] || '');
          default: return 0;
        }
      });

    const legendIndex = filteredLegends.findIndex(l => l.heroData.HeroID === legend.heroData.HeroID);
    if (legendIndex !== -1) {
      const page = Math.floor(legendIndex / itemsPerPage) + 1;
      setCurrentPage(page);
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [legends, searchQuery, sortType]);

  // Update URL on legend selection
  useEffect(() => {
    if (!selectedLegend) return;

    const currentParams = new URLSearchParams();
    currentParams.set('legend', String(selectedLegend.heroData.HeroID));
    const newUrl = `${window.location.pathname}?${currentParams}`;
    window.history.pushState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const heroID = params.get('legend');
      if (heroID && legends.length > 0) {
        const legend = legends.find(l => l.heroData.HeroID === parseInt(heroID));
        if (legend) {
          setSelectedLegend(legend);
          setIsDetailOpen(true);

          // Update page based on legend position
          const filteredLegends = legends
            .filter((l) => {
              if (!langs?.content) return true;
              const name = langs.content[l.DisplayNameKey] || '';
              const storeName = l.StoreName || '';
              const itemName = l.Item || '';
              return (
                name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                itemName.toLowerCase().includes(searchQuery.toLowerCase())
              );
            })
            .sort((a, b) => {
              switch (sortType) {
                case 'ReleaseAsc': return a.heroData.ReleaseOrderID - b.heroData.ReleaseOrderID;
                case 'ReleaseDesc': return b.heroData.ReleaseOrderID - a.heroData.ReleaseOrderID;
                case 'SkinsAsc': return (a.skins?.length || 0) - (b.skins?.length || 0);
                case 'SkinsDesc': return (b.skins?.length || 0) - (a.skins?.length || 0);
                case 'GoldAsc': return parseFloat(a.GoldCost) - parseFloat(b.GoldCost);
                case 'GoldDesc': return parseFloat(b.GoldCost) - parseFloat(a.GoldCost);
                case 'AlphaAsc': return (langs.content[a.DisplayNameKey] || '').localeCompare(langs.content[b.DisplayNameKey] || '');
                case 'AlphaDesc': return (langs.content[b.DisplayNameKey] || '').localeCompare(langs.content[a.DisplayNameKey] || '');
                default: return 0;
              }
            });

          const legendIndex = filteredLegends.findIndex(l => l.heroData.HeroID === parseInt(heroID));
          if (legendIndex !== -1) {
            const page = Math.floor(legendIndex / itemsPerPage) + 1;
            setCurrentPage(page);
            if (topRef.current) {
              topRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }
        } else {
          setSelectedLegend(legends[0]);
          setIsDetailOpen(false);
          setCurrentPage(1);
        }
      } else {
        setSelectedLegend(legends[0]);
        setIsDetailOpen(false);
        setCurrentPage(1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedLegend, legends, searchQuery, sortType]);

  const filteredLegends = legends
    .filter((legend) => {
      if (!langs?.content) return true;
      const name = langs.content[legend.DisplayNameKey] || '';
      const storeName = legend.StoreName || '';
      const itemName = legend.Item || '';
      return (
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .sort((a, b) => {
      switch (sortType) {
        case 'ReleaseAsc': return a.heroData.ReleaseOrderID - b.heroData.ReleaseOrderID;
        case 'ReleaseDesc': return b.heroData.ReleaseOrderID - a.heroData.ReleaseOrderID;
        case 'SkinsAsc': return (a.skins?.length || 0) - (b.skins?.length || 0);
        case 'SkinsDesc': return (b.skins?.length || 0) - (a.skins?.length || 0);
        case 'GoldAsc': return parseFloat(a.GoldCost) - parseFloat(b.GoldCost);
        case 'GoldDesc': return parseFloat(b.GoldCost) - parseFloat(a.GoldCost);
        case 'AlphaAsc': return (langs.content[legend.DisplayNameKey] || '').localeCompare(langs.content[b.DisplayNameKey] || '');
        case 'AlphaDesc': return (langs.content[b.DisplayNameKey] || '').localeCompare(langs.content[a.DisplayNameKey] || '');
        default: return 0;
      }
    });

  if (!selectedLegend) return null;
  const totalPages = Math.ceil(filteredLegends.length / itemsPerPage);
  const displayedLegends = filteredLegends.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="h-full w-full flex" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      {/* Left Side: Grid */}
      <div ref={topRef} className="flex-1 p-4 bg-gray-100 dark:bg-slate-900">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search Legends"
            className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-2xl px-2 py-1 mt-2 sm:mt-0 border border-gray-300 dark:border-slate-600 w-full sm:w-auto"
          />
          <select
            value={sortType}
            onChange={(e) => { setSortType(e.target.value); setCurrentPage(1); }}
            className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-2xl px-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-auto"
          >
            <option value="ReleaseAsc">Release Order (Asc)</option>
            <option value="ReleaseDesc">Release Order (Desc)</option>
            <option value="SkinsAsc">Skins (Asc)</option>
            <option value="SkinsDesc">Skins (Desc)</option>
            <option value="GoldAsc">Gold Cost (Asc)</option>
            <option value="GoldDesc">Gold Cost (Desc)</option>
            <option value="AlphaAsc">Alphabetical (A-Z)</option>
            <option value="AlphaDesc">Alphabetical (Z-A)</option>
          </select>
          <div className="flex justify-center space-x-2 bg-white dark:bg-slate-900 py-2 shadow dark:shadow-none">
            {Pagination(currentPage, totalPages).map((page, idx) => (
              <button
                key={idx}
                className={`px-3 py-1 rounded-md text-base font-bold ${currentPage === page ? 'bg-blue-500 dark:bg-blue-400 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white'} ${page === '...' ? 'cursor-default' : ''}`}
                onClick={() => handlePageChange(page)}
                disabled={page === '...'}
              >
                {page}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className={`grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6`}>
          {displayedLegends.map((legend) => (
            <div
              key={legend.heroData.HeroID}
              className={`relative bg-white dark:bg-slate-800 rounded-lg text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 hover:scale-105 transform transition-all p-2.5 shadow ${selectedLegend.heroData.HeroID === legend.heroData.HeroID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
              onClick={() => { setSelectedLegend(legend); setIsDetailOpen(true); }}
            >
              {legend.Label && (
                <div className="absolute top-2 left-2 bg-yellow-300 dark:bg-yellow-500 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-2xl">
                  {legend.Label}
                </div>
              )}
              <img
                src={`${host}/game/getGfx/${legend.heroData.PortraitFileName}/${legend.heroData.Portrait}M`}
                className="w-full h-32 object-contain mx-auto"
              />
              <div className="mt-2 text-gray-900 dark:text-white font-bold text-lg">
                {langs.content[legend.DisplayNameKey] || legend.DisplayNameKey}
              </div>
              <div className="flex justify-center gap-2 text-gray-600 dark:text-gray-300 text-base">
                <div>
                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-0.5" /><span>{legend.IdolCost}</span>
                </div>
                <div>
                  <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-0.5" /><span>{legend.GoldCost}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex justify-center mt-4 space-x-2 bg-white dark:bg-slate-900 py-2 shadow dark:shadow-none">
          {Pagination(currentPage, totalPages).map((page, idx) => (
            <button
              key={idx}
              className={`px-3 py-1 rounded-md text-base font-bold ${currentPage === page ? 'bg-blue-500 dark:bg-blue-400 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white'} ${page === '...' ? 'cursor-default' : ''}`}
              onClick={() => handlePageChange(page)}
              disabled={page === '...'}
            >
              {page}
            </button>
          ))}
        </div>
      </div>

      {/* Right Side: Legend Detail (Modal on Mobile) */}
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:w-[40%] lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:p-4 lg:shadow-none ${isDetailOpen ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 h-full w-full p-4 overflow-y-auto relative">
          <button
            className="lg:hidden absolute top-4 right-4 text-gray-900 dark:text-white"
            onClick={() => setIsDetailOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          {selectedLegend && (
            <div className='w-full'>
              <div className="flex items-center gap-2">
                <img
                  src={`${host}/game/getGfx/${selectedLegend.heroData.PortraitFileName}/${selectedLegend.heroData.Portrait}M`}
                  className="h-16"
                />
                <div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{langs.content[selectedLegend.DisplayNameKey] || selectedLegend.DisplayNameKey}</span>
                  {langs.content[selectedLegend.heroData.BioAKAKey] && (
                    <div className='flex items-center'>
                      <img
                        src={`${host}/game/getGfx/${selectedLegend.costumeType.CostumeIconFileName}/${selectedLegend.costumeType.CostumeIcon}`}
                        className="h-8 w-8 object-contain"
                      />
                      <span className="text-gray-600 dark:text-gray-300 text-base italic">{langs.content[selectedLegend.heroData.BioAKAKey]}</span>
                    </div>
                  )}
                </div>
              </div>

              {langs.content[selectedLegend.DescriptionKey] && (
                <div className="text-gray-600 dark:text-gray-300 text-sm mt-4">
                  {langs.content[selectedLegend.DescriptionKey]}
                </div>
              )}
              {selectedLegend.SearchTags && (
                <div className="col-span-2 flex flex-wrap gap-2 mt-2">
                  {splitTags(selectedLegend.SearchTags).map((tag, idx) => (
                    <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-lg text-center items-center mt-4">
                <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-2xl">
                  <span className="font-bold text-gray-900 dark:text-white">Gold Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{selectedLegend.GoldCost}</span>
                  </div>
                </div>
                <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-2xl">
                  <span className="font-bold text-gray-900 dark:text-white">Store ID</span>
                  <span className="text-gray-900 dark:text-white">{selectedLegend.StoreID}</span>
                </div>
                <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-2xl">
                  <span className="font-bold text-gray-900 dark:text-white">Hero ID</span>
                  <span className="text-gray-900 dark:text-white">{selectedLegend.heroData.HeroID}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-lg text-center items-center mt-2">
                <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-2xl">
                  <span className="font-bold text-gray-900 dark:text-white">Mammoth Coin Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{selectedLegend.IdolCost}</span>
                  </div>
                </div>
                <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 text-center items-center rounded-2xl">
                  <span className="font-bold text-gray-900 dark:text-white">Mammoth Sale Price</span>
                  {selectedLegend.IdolSaleCost ? (
                    <div className="flex items-center gap-1">
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" />
                      <span className="line-through text-red-600 dark:text-red-400">{selectedLegend.IdolCost}</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">{selectedLegend.IdolSaleCost}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-900 dark:text-white">No Sale Price</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setCurrentAnimation('Idle')}
                  className={`flex-1 py-2 rounded-2xl text-base ${currentAnimation === 'Idle' ? 'bg-blue-500 dark:bg-blue-400 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white'} font-bold transition-all duration-300`}
                >Idle</button>
                <button
                  onClick={() => setCurrentAnimation('Selected')}
                  className={`flex-1 py-2 rounded-2xl text-base ${currentAnimation === 'Selected' ? 'bg-blue-500 dark:bg-blue-400 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white'} font-bold transition-all duration-300`}
                >Selected</button>
                <button
                  onClick={() => setCurrentAnimation('Loop')}
                  className={`flex-1 py-2 rounded-2xl text-base ${currentAnimation === 'Loop' ? 'bg-blue-500 dark:bg-blue-400 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white'} font-bold transition-all duration-300`}
                >Selected Loop</button>
              </div>
              <div className="mt-4 lg:flex">
                <div className="w-full col-span-3 bg-gray-100 dark:bg-slate-800 rounded-lg p-2 flex items-center justify-center">
                  <SvgArrayFlipbook src={`${host}/game/anim/char/${selectedLegend.heroData.HeroID}-0/Animation_CharacterSelect/a__CharacterSelectAnimation/${currentAnimation}${selectedLegend.heroData.HeroName}/all`} fps={24} isLegend={true} />
                </div>
                <div className='flex lg:flex-col gap-2 lg:pl-2 pt-2 lg:pt-0 space-x-2 lg:space-x-0 justify-between'>
                  {selectedLegend.weapons.map(weapon => (
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-2 items-center text-center justify-center w-full">
                      <span className='pb-2 text-gray-900 dark:text-white'>{langs.content[weapon.DisplayNameKey]}</span>
                      <SvgArrayFlipbook
                        src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                        fps={24}
                        isLegend={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className='mt-4 '>
                <span className='text-center text-2xl text-gray-900 dark:text-white'>{langs.content[selectedLegend.DisplayNameKey]} Skins</span>
                <div className='grid grid-cols-2 sm:grid-cols-3 overflow-y-auto h-80 gap-2 mt-2'>
                  {selectedLegend.skins.map((r, i) => (
                    <div className='bg-gray-100 dark:bg-slate-800 rounded-lg flex flex-col text-center justify-center'>
                      <span className="text-gray-900 dark:text-white">{langs.content[r.DisplayNameKey]}</span>
                      <img src={`${host}/game/anim/char/${selectedLegend.heroData.HeroID}-${i + 1}/Animation_CharacterSelect/a__CharacterSelectAnimation/Selected${r.CrossoverGem ? r.CostumeName : selectedLegend.heroData.HeroName}/last`} className="h-32" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}