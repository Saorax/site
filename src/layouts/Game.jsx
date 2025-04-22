import { host } from '../stuff';
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { Transition } from '@headlessui/react'
import 'tailwindcss/tailwind.css';
import '../../fonts/style.css'
const defaultAnim = 'Animation_Unarmed/a__KickAnimation/Ready';
const fetchPostData = async (url, body, json) => {
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (json == true) return await res.json();
  return res;
};
const viewBoxCache = new Map();

function SvgArrayFlipbook({ src, fps = 60 }) {
  const [rawFrames, setRawFrames] = useState([]);
  const [frames, setFrames] = useState([]);
  const [index, setIndex] = useState(0);
  const hiddenRef = useRef(null);

  useEffect(() => {
    fetch(src)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const sanitized = data.map(d => typeof d === "string" ? d : d.svg);
          setRawFrames(sanitized);
        } else {
          console.error("Invalid SVG array:", data);
        }
      });
  }, [src]);

  useEffect(() => {
    if (rawFrames.length === 0 || !hiddenRef.current) return;

    const cacheKey = src;
    if (viewBoxCache.has(cacheKey)) {
      const finalViewBox = viewBoxCache.get(cacheKey);
      const normalized = rawFrames.map(svg => {
        if (typeof svg !== "string") return svg;
        return svg.replace(
          /viewBox="[^\"]+"[^>]+width="[^\"]+" height="[^\"]+"/,
          `viewBox="${finalViewBox}" width="${finalViewBox.split(" ")[2]}" height="${finalViewBox.split(" ")[3]}"`
        );
      });
      setFrames(normalized);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const calculateAndNormalize = async () => {
      const adjusted = [];

      for (const raw of rawFrames) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = raw;
        const svg = tempDiv.querySelector("svg");
        if (!svg) continue;

        hiddenRef.current.appendChild(svg);
        await new Promise(requestAnimationFrame);

        const bbox = svg.getBBox();
        console.log("BBox:", bbox);

        if (bbox.width === 0 && bbox.height === 0) {
          console.warn("Empty or unresolved frame:", svg.outerHTML);
        }

        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);

        hiddenRef.current.removeChild(svg);
        adjusted.push(raw);
      }

      const finalViewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
      viewBoxCache.set(cacheKey, finalViewBox);

      const normalized = adjusted.map(svg => {
        if (typeof svg !== "string") return svg;
        return svg.replace(
          /viewBox="[^\"]+"[^>]+width="[^\"]+" height="[^\"]+"/,
          `viewBox="${finalViewBox}" width="${maxX - minX}" height="${maxY - minY}"`
        );
      });

      setFrames(normalized);
    };

    calculateAndNormalize();
  }, [rawFrames]);

  useEffect(() => {
    if (frames.length === 0) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [frames, fps]);

  return (
    <>
      <div ref={hiddenRef} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: 0, height: 0, overflow: 'hidden' }} />
      {frames.length === 0 ? (
        <div className="w-[350px] h-[350px] rounded bg-black" />
      ) : (
        <div
          className="w-[350px] h-[350px] rounded"
          dangerouslySetInnerHTML={{ __html: frames[index] }}
        />
      )}
    </>
  );
}
function LegendStoreView({ legends, langs }) {
  const [selectedLegend, setSelectedLegend] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 28;

  useEffect(() => {
    if (legends.length > 0 && !selectedLegend) {
      setSelectedLegend(legends[0]); // auto-load first legend
    }

    /*legends.forEach((item) => {
      const img = new Image();
      img.src = `${host}/game/anim/${item.heroData.HeroID}/0/${defaultAnim}`;
    });*/
  }, [legends]);

  const displayedLegends = legends.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(legends.length / itemsPerPage);
  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Grid */}
      <div className="flex-1 p-4">
        <div className={`grid gap-4 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7`}>
          {displayedLegends.map((item, index) => (
            <div
              key={item.name || index}
              className={`bg-slate-800 rounded-lg text-center cursor-pointer hover:bg-slate-700 ${selectedLegend?.DisplayNameKey === item.DisplayNameKey ? 'ring-2 ring-slate-400' : ''}`}
              onClick={() => setSelectedLegend(item)}
            >
              <div className="flex-col rounded flex items-center justify-center">
                <img
                  src={`${host}/game/getGfx/${item.heroData.PortraitFileName}/${item.heroData.Portrait}M`}
                  loading="eager"
                  className="w-32"
                />
              </div>
              <div className="text-white rounded-b-lg flex flex-col text-xl p-1 bg-slate-700">
                <span>{langs.content[item.DisplayNameKey]}</span>
                <div className="flex justify-center text-sm text-gray-300 m-0.5 space-x-3">
                  <div>
                    <img src={`${host}/game/getGfx/UI_1/DefineSprite_2167`} className="inline h-5 mr-0.5" /><span>{item.IdolCost}</span>
                  </div>
                  <div>
                    <img src={`${host}/game/getGfx/UI_1/DefineSprite_2357`} className="inline h-5 mr-0.5" /><span>{item.GoldCost}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex justify-center mt-4 space-x-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              style={{ fontFamily: 'BHLatinBold' }}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded-md text-sm font-bold ${currentPage === i + 1 ? 'bg-slate-400 text-black' : 'bg-slate-700 hover:bg-slate-500'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Permanent Side Panel */}
      {selectedLegend && (
        <div className="w-full lg:w-[600px] bg-slate-900 p-6 border-l border-slate-700 overflow-y-auto">
          <div className="text-white w-full space-y-4">
            <div className="text-2xl font-bold">
              {langs.content[selectedLegend.DisplayNameKey]}

              <p className='text-base font-normal'>{langs.content[selectedLegend.DescriptionKey]}</p>
            </div>
            <SvgArrayFlipbook
              src={`${host}/game/anim/${selectedLegend.heroData.HeroID}/0/Animation_CharacterSelect/a__CharacterSelectAnimation/Idle${selectedLegend.heroData.HeroName}/all`}
              fps={24}
            />
            <div className="space-y-1 text-sm text-gray-200 mt-2">
              <p><span className="font-bold text-white">ID:</span> {selectedLegend.heroData.HeroID}</p>
              <p><span className="font-bold text-white">Internal:</span> {selectedLegend.heroData.HeroName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function PromoCodesView() {
  return <div className="text-white text-lg">Promo Codes content coming soon...</div>;
}

function TitlesView() {
  return <div className="text-white text-lg">Titles content coming soon...</div>;
}
export default function GameDatabase() {
  const [legends, setLegends] = useState([]);
  const [langs, setLangs] = useState([]);
  const [selectedLang, setSelectedLang] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Store Data');
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const categories = [
    'Store Data', 'Promo Codes', 'Titles',
  ];
  const subcategories = {
    'Store Data': [
      'Legends', 'Skins', 'Taunts', 'Weapon Skins', 'Sidekicks',
      'Colors', 'KO Effect', 'Chests', 'Avatars', 'Podiums',
      'Bundles', 'Player Themes', 'Entitlement', 'Emojis', 'Companions'
    ],
    'Promo Codes': null,
    'Titles': null
  };
  /*
        <div>language types (IMPLEMENT EVERYWHERE)</div>

        <div>map data</div>
        <div>animations</div>
        <div>more legends stuff</div>

        <div>achievements</div>
        <div>controller types</div>
        <div>battle pass stuff (current & past)</div>
        <div>ui themes per event</div>
        <div>color exceptions for color schemes</div>
        <div>color scheme list</div>
        <div>dodge types</div>
        <div>gamemode types</div>
        <div>guild tags</div>
        <div>helpful hints (when loading)</div>
        <div>hurtboxes</div>
        <div>levelset types</div>
        <div>mission types</div>
        <div>quest types (battle pass quests?)</div>
        <div>skirmishes (+rewards)</div>
        <div>splash arts?</div>
        <div>stat types</div>

        <div>list of avatars</div>
        <div>chests</div>
        <div>companion types</div>
        <div>emoji list</div>
        <div>moniker titles</div>
        <div>player ui themes</div>
        <div>podium types</div>
        <div>promo types (redeemable codes)</div>
        <div>season border types</div>
        <div>spawn bots</div>
        <div>steam purchase types</div>
        <div>store? lol</div>
        <div>taunt types? maybe make dedicated store with everything store-ish related</div>
        <div>weapon skins</div>
  */


  useEffect(() => {
    const handleResize = () => {
      const svgContainer = document.querySelector('.svg-container svg');
      if (svgContainer) {
        if (window.innerWidth < 768) {
          svgContainer.children[0].setAttribute('transform', svgContainer.children[0].getAttribute('transform').replace('scale(3)', 'scale(2)'));
        } else {
          svgContainer.children[0].setAttribute('transform', svgContainer.children[0].getAttribute('transform').replace('scale(2)', 'scale(3)'));
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

  }, []);
  useEffect(() => {
    fetch(`${host}/game/storeData`)
      .then(res => res.json())
      .then(data => {
        console.log(data)
        setLegends(data.legends)
      })
      .catch(err => console.error(err));

  }, [selectedCategory, selectedSubcategory]);
  useEffect(() => {
    fetch(`${host}/game/langs`)
      .then(res => res.json())
      .then(data => {
        setLangs(data)
      })
      .catch(err => console.error(err));
  }, []);

  const renderContent = () => {
    if (selectedCategory === 'Store Data') {
      switch (selectedSubcategory) {
        case 'Legends':
          return <LegendStoreView legends={legends} langs={langs[selectedLang]} subcat={selectedSubcategory} />;
        case 'Skins':
        case 'Taunts':
        case 'Weapon Skins':
        case 'Sidekicks':
        case 'Colors':
        case 'KO Effect':
        case 'Chests':
        case 'Avatars':
        case 'Podiums':
        case 'Bundles':
        case 'Player Themes':
        case 'Entitlement':
        case 'Emojis':
        case 'Companions':

        default:
          return <div className="text-white text-sm italic">Select a subcategory to view items.</div>;
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
    <div className="flex flex-col md:flex-row overflow-y-auto h-screen dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 p-4 space-y-3 overflow-y-auto">
        <div className="flex-1 p-2 overflow-y-auto" style={{ fontFamily: langs[selectedLang]?.font || 'BHLatinBold' }}>
          <div className="flex flex-col">
            <label style={{ fontFamily: 'BHLatinBold' }} className="text-white font-bold mr-2">Data Language</label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(parseInt(e.target.value))}
              className="bg-slate-700 text-white rounded px-2 py-1"
            >
              {langs.map((lang, index) => (
                <option style={{ fontFamily: lang.font || 'BHLatinBold' }} key={index} value={index}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {categories.map((cat) => (
          <Disclosure key={cat} defaultOpen={cat === selectedCategory}>
            {({ open }) => (
              <div>
                <Disclosure.Button
                  className={`w-full text-left px-4 py-2 rounded-md font-bold flex justify-between items-center text-white ${selectedCategory === cat ? 'bg-slate-600 ' : 'hover:bg-slate-700'
                    }`}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedSubcategory(null);
                    setCurrentPage(1);
                  }}
                >
                  {cat}
                  {subcategories[cat] && (
                    <span>{open ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}</span>
                  )}
                </Disclosure.Button>
                <Disclosure.Panel>
                  {subcategories[cat] && (
                    <div className="mt-1 ml-4 space-y-1">
                      {subcategories[cat].map((sub) => (
                        <button
                          key={sub}
                          onClick={() => {
                            setSelectedSubcategory(sub);
                            setCurrentPage(1);
                          }}
                          className={`block w-full text-left px-3 py-1 rounded-md text-sm text-white ${selectedSubcategory === sub ? 'bg-slate-600' : 'hover:bg-slate-700'
                            }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </Disclosure.Panel>
              </div>
            )}
          </Disclosure>
        ))}
      </div>
      {/* Main Content */}
      {renderContent()}
    </div>
  );
}
