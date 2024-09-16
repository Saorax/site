import React, { useState, useEffect, useRef } from 'react';
import { Disclosure, RadioGroup } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { FaTwitter, FaTwitch } from 'react-icons/fa';
import 'tailwindcss/tailwind.css';
import 'tailwind-scrollbar';
import { host } from "../../stuff";

const regions = ['North America', 'Europe', 'South America', 'Southeast Asia', 'Australia', 'Middle East & North Africa'];
const shortRegion = ['NA', 'EU', 'SA', 'SEA', 'AUS', 'MENA'];
const tourneyYears = ["2024"];
const getRegionByShortCode = (shortCode) => {
  const index = shortRegion.indexOf(shortCode);
  if (index !== -1) {
      return regions[index];
  } else {
      return null;
  }
};
function ordinal(i) {
  const j = i % 10;
  const k = i % 100;
  if (j === 1 && k !== 11) return i + "st";
  if (j === 2 && k !== 12) return i + "nd";
  if (j === 3 && k !== 13) return i + "rd";
  return i + "th";
}

const fetchData = async (url) => {
  const res = await fetch(url);
  const data = await res.json();
  return data;
};

const fetchPostData = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return data;
};

function MakeList({ data, selectedType, onClick }) {
  const isTopFourCircuit = selectedType === '1' && data.place <= 4;
  let backgroundColor = isTopFourCircuit || data.place === 1 ? 'bg-yellow-400 hover:bg-yellow-500' : data.place === 2 ? 'bg-gray-300 hover:bg-gray-400' : data.place === 3 ? 'bg-yellow-800 hover:bg-yellow-900' : 'bg-slate-900 hover:bg-slate-700';
  let textColor = selectedType === '1' || data.place === 1 || data.place === 2 ? 'text-slate-900' : 'text-white';
  const eligG = 'bg-green-600 hover:bg-green-700';
  const eligP = 'bg-yellow-600 hover:bg-yellow-700';
  const eligE = 'bg-red-800 hover:bg-red-900';
  let elig = '';
  if (data.eligibility) {
    if (data.eligibility == 1) elig = eligG;
    if (data.eligibility == 2) elig = eligP;
    if (data.eligibility == 3) elig = eligE;
  }
  if (selectedType === '1') {
    if(data.playedTotal == 4) {
      if (data.place <= 4) {
        backgroundColor = 'bg-green-600 hover:bg-green-700';
        textColor = 'text-slate-900'
      } else {
        backgroundColor = 'bg-red-800 hover:bg-red-900';
        textColor = 'text-gray-400'
      }
    };
    if (data.eligibility && data.eligibility == 3) textColor = 'text-gray-400'
  }
  let rankChange;
  if (data.lastPlace != 0 && data.lastPlace != data.place ) {
    if (data.lastPlace > data.place) {
      rankChange = <span className="text-green-600 ml-2">↑ {data.lastPlace - data.place}</span>;
    } else if (data.lastPlace < data.place) {
      rankChange = <span className="text-red-500 ml-2">↓ {data.place - data.lastPlace}</span>;
    }
  } else if (data.place == data.lastPlace) rankChange = <span className="text-orange-500 ml-3">≈</span>;
  return (
    <tr className={`justify-between cursor-pointer ${selectedType === '1' && data.playedTotal <= 3 ? elig : backgroundColor} border-b border-r dark:border-slate-800`} onClick={() => onClick(data)}>
      <td className={`lg:p-3 p-2 font-bold ${textColor} md:w-20 w-16`}>{ordinal(data.place)}</td>
      <td className='md:w-20 w-16 font-bold'> {rankChange}</td>
      <th scope="row" className="w-[40%]">
        <div className="flex items-center">
          {data.image ? (
            <img src={data.image} alt={data.name} className="hidden md:visible w-8 h-8 lg:w-10 lg:h-10 rounded-full" />
          ) : (
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full hidden md:flex items-center justify-center bg-slate-500 text-white">
              {data.name.charAt(0)}
            </div>
          )}
          <span className={`md:ml-3 font-medium text-base lg:text-lg ${textColor}`}>{data.name}</span>
        </div>
      </th>
      <td className={`hidden sm:table-cell font-medium ${textColor} min-w-20 text-base md:text-lg`}>{selectedType == '1' ? data.total : data.total?.toFixed(6)}</td>
      <td className={`table-cell sm:hidden font-medium ${textColor} min-w-20 text-base md:text-lg`}>{selectedType == '1' ? data.total : data.total?.toFixed(3)}</td>
      <td className="min-w-30 pl-2.5 hidden md:table-cell">
        <div className="flex space-x-2">
          {data.socials.twitter && (
            <a href={`https://twitter.com/${data.socials.twitter}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
              <FaTwitter size={20}/>
            </a>
          )}
          {data.socials.twitch && (
            <a href={`https://twitch.tv/${data.socials.twitch}`} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-400">
              <FaTwitch size={20} />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function RankingsList({ preset, region, minifyRank, selectedType, gamemode, dateDecay, tourneyIds }) {
  const [rankList, setRankList] = useState([]);
  const [tourneyInfo, setTourneyInfo] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(32);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [pages, setPages] = useState(1);
  const [presetData, setPresetData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const fetchAllData = async () => {
      const body = selectedType === '0' ? { page, region, gamemode, decay: dateDecay, tourneys: tourneyIds } : { page, perPage, noStart: !minifyRank };
      if (searchTerm) {
        body.search = searchTerm;
      }
      const url = selectedType === '0' ? `${host}/pr/official` : `${host}/pr/circuit/${preset}/${region}`;
      const data = await fetchPostData(url, body);
      setRankList(data.players);
      setTotalPlayers(data.data.players);
      setTourneyInfo(data.data);
      setPages(data.data.pages);
    };
    fetchAllData();
  }, [page, perPage, preset, region, minifyRank, searchTerm, gamemode, dateDecay, selectedType, tourneyIds]);

  useEffect(() => {
    if (selectedType === '1') {
      const fetchPresetData = async () => {
        const data = await fetchData(`${host}/pr/data/presets/circuit`);
        setPresetData(data[preset]);
      };
      fetchPresetData();
    } else if (selectedType === '0') {
      const fetchPresetData = async () => {
        let data = await fetchData(`${host}/pr/data/tourneys/officials`);
        data = data.filter((r) => tourneyIds.includes(r.id));
        setPresetData(data);
      };
      fetchPresetData();
    }
  }, [preset, selectedType]);

  const halfLength = Math.ceil(rankList.length / 2);

  const handlePrevPage = () => {
    setPage(prev => (prev > 1 ? prev - 1 : pages));
  };

  const handleNextPage = () => {
    setPage(prev => (prev < pages ? prev + 1 : 1));
  };

  const handleSearchChange = (event) => {
    const { value } = event.target;
    setSearchTerm(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setSearchTerm(value);
    }, 500);
  };

  const closeModal = () => {
    setSelectedPlayer(null);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="block md:flex md:pt-1 justify-between items-center">
        {presetData && (
          <div className="flex items-center justify-center mb-4">
            <img src={tourneyInfo.tourneys?.first.img} alt={tourneyInfo?.tourneys?.first.name} className="w-16 h-16 mr-4 rounded-lg" />
            <div>
              <div className="text-gray-200 font-medium text-xl">{tourneyInfo.tourneys?.first.name}</div>
              {selectedType === '1' ? <div className="text-lg text-gray-500 dark:text-gray-400">
                Tournaments: {presetData.map(p => p.name).join(", ")}
              </div> : <div className="text-lg text-gray-500 dark:text-gray-300">
                  {gamemode === '1v1' ? 'Singles' : 'Doubles'} • {getRegionByShortCode(region)}
                </div>}
            </div>
          </div>
        )}
        <div className='flex flex-col lg:flex-row justify-center items-center'>
          <input
            type="text"
            placeholder="Search..."
            className="text-gray-200 w-full p-2 border bg-slate-800 border-gray-700 rounded-lg focus:outline-none focus:ring focus:ring-blue-500"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <div className='flex flex-col justify-center items-center'>
            <span className="text-base text-slate-800 dark:text-slate-500">
              Showing <span id="pageMin" className="font-medium text-slate-950 dark:text-white">{(page - 1) * perPage + 1}</span> to <span id="pageMax" className="font-medium text-slate-950 dark:text-white">{Math.min(page * perPage, totalPlayers)}</span> of <span id="maxPlayers" className="font-medium text-slate-950 dark:text-white">{totalPlayers}</span> Players
            </span>
            <div className="inline-flex md:pl-2 pt-1 md:pt-0">
              <button onClick={handlePrevPage} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-l hover:bg-slate-950 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white">
                <svg aria-hidden="true" className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd"></path>
                </svg>
                Prev
              </button>
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-900 border-0 border-l border-slate-800 hover:bg-slate-950 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white">
                {page}/{pages}
              </button>
              <button onClick={handleNextPage} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-900 border-0 border-l border-slate-800 rounded-r hover:bg-slate-950 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white">
                Next
                <svg aria-hidden="true" className="w-5 h-5 ml-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
                </svg>
              </button>
            </div>
          </div>
          
        </div>
      </div>
      <div className="overflow-auto w-full flex flex-col lg:flex-row scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <div className="w-full lg:w-1/2">
          <table className="w-full table-fixed text-lg text-left text-slate-600 dark:text-slate-500">
            <thead className="text-sm text-slate-800 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-500">
              <tr className='justify-between'>
                <th scope="col" className="md:w-20 w-16 p-4 rounded-tl-lg">#</th>
                <th scope="col" className='md:w-20 w-16'></th>
                <th scope="col" className="w-[40%]">name</th>
                <th scope="col" className="min-w-20">points</th>
                <th scope="col" className="pl-2.5 min-w-32 sm:rounded-tr-lg lg:rounded-tr-none hidden md:table-cell">socials</th>
              </tr>
            </thead>
            <tbody id="rankingBoard1">
              {rankList.slice(0, halfLength).map((data, i) => (
                <MakeList key={i} data={data} selectedType={selectedType} onClick={setSelectedPlayer} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="w-full lg:w-1/2">
          <table className="w-full table-fixed text-lg text-left text-slate-600 dark:text-slate-500">
            <thead className="hidden lg:table-header-group text-sm text-slate-800 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-500">
              <tr  className='justify-between'>
                <th scope="col" className="md:w-20 w-16 p-4">#</th>
                <th scope="col" className='md:w-20 w-16'></th>
                <th scope="col" className="w-[40%]">name</th>
                <th scope="col" className="min-w-20">points</th>
                <th scope="col" className="pl-2.5 min-w-32 rounded-tr-lg hidden md:table-cell">socials</th>
              </tr>
            </thead>
            <tbody id="rankingBoard2">
              {rankList.slice(halfLength).map((data, i) => (
                <MakeList key={i} data={data} selectedType={selectedType} onClick={setSelectedPlayer} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {(selectedPlayer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={closeModal}>
          <div className="text-white bg-white dark:bg-gray-900 p-4 rounded-lg shadow-lg max-h-[80%] min-w-[45%] overflow-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 scrollbar-thumb-rounded-full scrollbar-track-rounded-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-center text-2xl font-bold mb-4">{selectedPlayer.name}'s Best Placements</h2>
            <div className='space-y-2'>
                {selectedType == 0 && selectedPlayer.tourneyInfo.map((info, index) => (
                  <div key={index} className='p-2 border-2 border-slate-500 rounded-xl'>
                    <div className='flex justify-between pb-3'>
                      <div className='flex items-center'>
                        <img className="h-12 w-12 rounded-lg" src={info.image}/>
                        <div className='pl-2 flex flex-col'>
                          <span className="text-2xl font-bold">{info.tourney}</span>
                          <span>{info.timeSince} days ago</span>
                        </div>
                      </div>
                      <div className='flex text-right flex-col'>
                        <span className='text-2xl font-bold'>{ordinal(info.placement.main)}</span>
                        <span className='text-base font-normal'>Seed: {info.placement.seed}</span>
                        <span className='text-right text-xl font-bold'>{info.placement.points} pts</span>
                      </div>
                    </div>
                    <div className='flex justify-between'>
                      <div className='flex flex-col justify-around pb-2'>
                        <div className='flex flex-col pb-4'>
                          <span className='text-2xl font-bold'>Wins ({info.wins.points} pts)</span>
                          {info.wins.adv.length === 0 ? 'no wins?' : info.wins.adv.map((r) => (
                            <div key={r.name} className='flex flex-col py-1'>
                              <span className='text-xl font-medium'>{r.name}</span>
                              <span className='text-base text-gray-300 font-medium'>Seed {ordinal(r.seed)} ~ {r.points} pts</span>
                            </div>
                          ))}
                        </div>
                        <div className='flex flex-col'>
                          <span className='text-2xl font-bold'>Losses ({info.loss.points} pts)</span>
                          {info.loss.adv.length === 0 ? 'no losses' : info.loss.adv.map((r) => (
                            <div key={r.name} className='flex flex-col py-1'>
                              <span className='text-xl font-medium'>{r.name}</span>
                              <span className='text-base text-gray-300 font-medium'>out at {ordinal(r.placement)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className='flex flex-col space-y-8'>
                        <div className='space-y-2'>
                          <div className='flex flex-col items-center'>
                            <span className='text-2xl'>Recency</span>
                            <span className='text-lg font-medium'>{info.total.recency}</span>
                          </div>
                          <div className='flex flex-col items-center'>
                            <span className='text-2xl'>Tourney Multiplier</span>
                            <span className='text-xl font-medium'>x{info.total.multiplier}</span>
                          </div>
                          </div>
                        <div className='flex flex-col space-y-2'>
                          <div className='flex space-x-6 items-center'>
                            <div className='flex flex-col items-center'>
                              <span className='text-2xl'>Raw Total</span>
                              <span className='text-xl font-medium'>{info.total.noMult} pts</span>
                            </div>
                            <div className='flex flex-col items-center'>
                              <span className='text-2xl'>Total (x{info.total.multiplier})</span>
                              <span className='text-xl font-medium'>{parseFloat(info.total.noMult) * info.total.multiplier} pts</span>
                            </div>
                          </div>
                          <div className='flex flex-col items-center'>
                            <span className='text-2xl'>Total</span>
                            <span className='text-xl font-medium'>{info.total.mult} pts</span>
                          </div>
                          <span></span>
                        </div>
                      </div>
                    </div>
                    </div>
                ))}
                {selectedType == 1 && selectedPlayer.tourneyInfo.map((info, index) => (
                  <div key={index} className='p-2 border-2 border-slate-500 rounded-xl'>
                    <div className='flex justify-between pb-3'>
                      <div className='flex items-center'>
                        <img className="h-12 w-12 rounded-lg" src={info.image}/>
                        <div className='pl-2 flex flex-col'>
                          <span className="text-2xl font-bold">{info.tourney}</span>
                        </div>
                      </div>
                      <div className='flex text-right flex-col'>
                        <span className='text-2xl font-bold'>{ordinal(info.placement)}</span>
                        <span className='text-right text-xl font-bold'>{info.points} points</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Sidebar = ({ selectedGamemode, setSelectedGamemode, dateDecay, setDateDecay, minifyRank, setMinifyRank, showGamemode, selectedType, setPreset, setRegion, setTourneyIds, region }) => {
  const [presets, setPresets] = useState([]);
  const [tourneys, setTourneys] = useState([]);
  const [lanPresets, setLanPresets] = useState([]);
  const [circuitPresets, setCircuitPresets] = useState([]);
  const [lanTourneys, setLanTourneys] = useState([]);
  const [circuit, setCircuit] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [tourneySelections, setTourneySelections] = useState({});

  useEffect(() => {
    const fetchAllData = async () => {
      const officialsPresets = await fetchData(`${host}/pr/data/presets/officials`);
      const tourneysData = await fetchData(`${host}/pr/data/tourneys/officials`);
      for (let i = 0; i < tourneysData.length; i++) {
        if (!tourneyYears.includes(tourneysData[i].year)) tourneyYears.push(tourneysData[i].year);
      }
      setPresets(officialsPresets);
      setTourneys(tourneysData);
      setLanPresets(await fetchData(`${host}/pr/data/presets/lans`));
      const circuitData = await fetchData(`${host}/pr/data/presets/circuit`);
      setCircuitPresets(circuitData.map((preset, i) => {
        const season = i % 2 === 0 ? "Summer" : "Winter";
        return { preset: preset, name: `${season} Circuit ${preset[0].year}` };
      }));
      setTourneyIds(officialsPresets[0].map(r => r.id));
      setLanTourneys(await fetchData(`${host}/pr/data/tourneys/lans`));
      setCircuit(await fetchData(`${host}/pr/data/tourneys/circuit`));
    };
    fetchAllData();
  }, []);

  const handlePresetChange = (index) => {
    setSelectedPreset(index);
    setPreset(index);
    const presetTourneys = selectedType === '1' ? circuitPresets[index].preset : presets[index];
    const newSelections = {};
    presetTourneys.forEach(tourney => {
      newSelections[tourney.id] = true;
    });
    setTourneySelections(newSelections);
    setTourneyIds(Object.keys(newSelections).map(key => parseInt(key, 10)));
  };

  const handleRegionChange = (region) => {
    setRegion(region);
  };

  const handleTourneyToggle = (id) => {
    setTourneySelections(prev => {
      const newSelections = { ...prev, [id]: !prev[id] };
      setTourneyIds(Object.keys(newSelections).filter(key => newSelections[key]).map(key => parseInt(key, 10)));
      return newSelections;
    });
  };

  const renderTournaments = () => {
    return tourneyYears.map((year, index) => {
      const yearTourneys = tourneys.filter(t => t.year === year);
      return (
        <div key={index} className="mb-4">
          <Disclosure defaultOpen={year === "2024"}>
            {({ open }) => (
              <>
                <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-xl font-medium text-left text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring focus-visible:ring-gray-500 focus-visible:ring-opacity-75 shadow-md">
                  <span>{year}</span>
                  {open ? <ChevronUpIcon className="w-5 h-5 text-gray-900 dark:text-white" /> : <ChevronDownIcon className="w-5 h-5 text-gray-900 dark:text-white" />}
                </Disclosure.Button>
                <Disclosure.Panel className="px-0.5 pt-4 pb-2 text-sm md:text-base text-gray-900 dark:text-white">
                  {yearTourneys.map((tourney, i) => (
                    <div key={i} className="flex justify-between p-2 bg-white dark:bg-gray-800 border border-gray-300 rounded-lg shadow-sm mb-2 dark:border-gray-700">
                      <div className="flex">
                        <div className="flex items-center h-5">
                          <input 
                            type="checkbox" 
                            id={`tourney-${tourney.id}`} 
                            name={`tourney-${tourney.id}`} 
                            className="w-4 h-4 text-blue-600 bg-gray-200 border-gray-400 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" 
                            checked={!!tourneySelections[tourney.id]} 
                            onChange={() => handleTourneyToggle(tourney.id)}
                          />
                        </div>
                        <div className="ml-2">
                          <label htmlFor={`tourney-${tourney.id}`} className="text-sm md:text-base font-medium text-gray-900 dark:text-gray-300">{tourney.name}</label>
                          <p className="text-xs md:text-sm font-normal text-gray-600 dark:text-gray-400">Regions: {tourney.regions.join(", ")}</p>
                          <p className="text-xs md:text-sm font-normal text-gray-600 dark:text-gray-400">Gamemodes: {tourney.gamemode.join(", ")}</p>
                        </div>
                      </div>
                      <img src={tourney.image} alt={tourney.name} className="w-12 h-12 rounded-lg" />
                    </div>
                  ))}
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>
        </div>
      );
    });
  };

  return (
    <div className="h-full p-0.5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 scrollbar-thumb-rounded-full scrollbar-track-rounded-full">
      {showGamemode && selectedType === '0' && (
        <div className="py-4">
          <span className="block mb-2 text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">Gamemode</span>
          <RadioGroup value={selectedGamemode} onChange={setSelectedGamemode}>
            <RadioGroup.Label className="sr-only">Select a gamemode</RadioGroup.Label>
            <div className="space-y-2 text-white">
              <RadioGroup.Option value="1v1">
                {({ checked }) => (
                  <div className={`flex items-center ${checked ? 'bg-blue-600 text-white' : ''} p-2 rounded-lg cursor-pointer`} onClick={() => setSelectedGamemode('1v1')}>
                    <input
                      type="radio"
                      value="1v1"
                      name="gm-radio"
                      className="hidden"
                      checked={checked}
                      onChange={() => setSelectedGamemode('1v1')}
                    />
                    <label className="ml-2 text-sm md:text-lg font-medium sm:text-xs">{checked ? '1v1 Power Rankings' : '1v1 Power Rankings'}</label>
                  </div>
                )}
              </RadioGroup.Option>
              <RadioGroup.Option value="2v2">
                {({ checked }) => (
                  <div className={`flex items-center ${checked ? 'bg-blue-600 text-white' : ''} p-2 rounded-lg cursor-pointer`} onClick={() => setSelectedGamemode('2v2')}>
                    <input
                      type="radio"
                      value="2v2"
                      name="gm-radio"
                      className="hidden"
                      checked={checked}
                      onChange={() => setSelectedGamemode('2v2')}
                    />
                    <label className="ml-2 text-sm md:text-lg font-medium sm:text-xs">{checked ? '2v2 Power Rankings' : '2v2 Power Rankings'}</label>
                  </div>
                )}
              </RadioGroup.Option>
            </div>
          </RadioGroup>
        </div>
      )}
      <label className="relative inline-flex items-center cursor-pointer mt-4">
        <input
          type="checkbox"
          id="decay"
          value="decay"
          className="sr-only peer"
          checked={dateDecay}
          onChange={() => setDateDecay(!dateDecay)}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:text-xs">Add Date Decay</span>
      </label>
      <hr className="h-px my-2 bg-gray-300 border-0 dark:bg-gray-700" />

      {/* Regions */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-xl font-medium text-left text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring focus-visible:ring-gray-500 focus-visible:ring-opacity-75 shadow-md">
              <span>Regions</span>
              {open ? <ChevronUpIcon className="w-5 h-5 text-gray-900 dark:text-white" /> : <ChevronDownIcon className="w-5 h-5 text-gray-900 dark:text-white" />}
            </Disclosure.Button>
            <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-gray-900 dark:text-white sm:text-xs">
              <RadioGroup value={region} onChange={setRegion}>
                <RadioGroup.Label className="sr-only">Select a region</RadioGroup.Label>
                  <div className="space-y-2 text-white">
                  {regions.map((region, i) => {
                    if (selectedType === '0') {
                      return (
                        <RadioGroup.Option key={shortRegion[i]} value={shortRegion[i]}>
                      {({ checked }) => (
                        <div className={`flex items-center ${checked ? 'bg-blue-600 text-white' : ''} p-2 rounded-lg cursor-pointer`} onClick={() => handleRegionChange(shortRegion[i])}>
                          <input
                            type="radio"
                            value={shortRegion[i]}
                            name="r-radio"
                            className="hidden"
                            checked={checked}
                            onChange={() => handleRegionChange(shortRegion[i])}
                          />
                          <label className="ml-2 md:text-lg font-medium text-sm">{region}</label>
                        </div>
                      )}
                    </RadioGroup.Option>
                      );
                    } else if (selectedType === '1' && ['North America', 'Europe', 'South America'].includes(region)) {
                      return (
                        <RadioGroup.Option key={shortRegion[i]} value={shortRegion[i]}>
                      {({ checked }) => (
                        <div className={`flex items-center ${checked ? 'bg-blue-600 text-white' : ''} p-2 rounded-lg cursor-pointer`} onClick={() => handleRegionChange(shortRegion[i])}>
                          <input
                            type="radio"
                            value={shortRegion[i]}
                            name="r-radio"
                            className="hidden"
                            checked={checked}
                            onChange={() => handleRegionChange(shortRegion[i])}
                          />
                          <label className="ml-2 md:text-lg font-medium text-sm">{region}</label>
                        </div>
                      )}
                    </RadioGroup.Option>
                      )
                    }
                    return null;
                  })}
                  </div>
                </RadioGroup>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>

      <hr className="h-px my-2 bg-gray-300 border-0 dark:bg-gray-700" />

      {/* Presets */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-xl font-medium text-left text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring focus-visible:ring-gray-500 focus-visible:ring-opacity-75 shadow-md">
              <span>Presets</span>
              {open ? <ChevronUpIcon className="w-5 h-5 text-gray-900 dark:text-white" /> : <ChevronDownIcon className="w-5 h-5 text-gray-900 dark:text-white" />}
            </Disclosure.Button>
            <Disclosure.Panel className=" p-2 pt-2 pb-2 md:text-sm text-gray-900 dark:text-white text-xs">
              <RadioGroup value={selectedPreset} onChange={handlePresetChange}>
                <RadioGroup.Label className="sr-only">Select a preset</RadioGroup.Label>
                {selectedType === '1' ? (
                  circuitPresets.slice().map((preset, i) => (
                    <RadioGroup.Option key={i} value={i} className={({ checked }) => `${checked ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300'} flex justify-between items-center py-2 border border-gray-300 rounded-lg shadow-sm mb-2 dark:border-gray-700 cursor-pointer`}>
                      {({ checked }) => (
                        <>
                          <div className="flex items-center">
                            <input type="radio" id={`preset-${i}`} name="preset" className="hidden" checked={checked} readOnly />
                            <label htmlFor={`preset-${i}`} className="ml-2 md:text-base font-medium text-sm">{preset.name}</label>
                          </div>
                          <img src={preset.preset[preset.preset.length - 1].image} alt={preset.name} className="w-12 h-12 rounded-lg" />
                        </>
                      )}
                    </RadioGroup.Option>
                  ))
                ) : (
                  presets.slice().map((preset, i) => (
                    <RadioGroup.Option key={i} value={i} className={({ checked }) => `${checked ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300'} flex justify-between items-center py-2 border border-gray-300 rounded-lg shadow-sm mb-2 dark:border-gray-700 cursor-pointer`}>
                      {({ checked }) => (
                        <>
                          <div className="flex items-center">
                            <input type="radio" id={`preset-${i}`} name="preset" className="hidden" checked={checked} readOnly />
                            <label htmlFor={`preset-${i}`} className="ml-2 md:text-base font-medium text-sm">{preset[0].name}</label>
                          </div>
                          <img src={preset[0].image} alt={preset[0].name} className="w-12 h-12 rounded-lg" />
                        </>
                      )}
                    </RadioGroup.Option>
                  ))
                )}
              </RadioGroup>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>

      <hr className="h-px my-2 bg-gray-300 border-0 dark:bg-gray-700" />
      {selectedType === '1' && (
        <div className='flex flex-col text-base'>
          <li className='text-green-600'>Green means they are guaranteed to go to the Royale</li>
          <li className='text-yellow-600'>Yellow/Orange means they can still make it to the Royale</li>
          <li className='text-red-600'>Red means they cannot make it to the royale</li>
        </div>
      )}
      {/* Individual Tournaments */}
      {selectedType === '0' && (
        <a className="flex justify-center pl-2.5 py-3">
          <span className="self-center text-2xl font-semibold text-gray-900 dark:text-white">Individual Tournaments</span>
        </a>
      )}
      {selectedType === '0' && renderTournaments()}
    </div>
  );
};

const PowerRankings = () => {
  const [selectedType, setSelectedType] = useState('0');
  const [selectedGamemode, setSelectedGamemode] = useState('1v1');
  const [dateDecay, setDateDecay] = useState(true);
  const [minifyRank, setMinifyRank] = useState(true);
  const [preset, setPreset] = useState(0);
  const [region, setRegion] = useState("NA");
  const [tempPreset, setTempPreset] = useState(0);
  const [tourneyIds, setTourneyIds] = useState([]);
  const sidebarRef = useRef();

  const handleOutsideClick = (e) => {
    if (sidebarRef.current && !sidebarRef.current.contains(e.target) && window.innerWidth < 768) {
      document.getElementById('logo-sidebar').classList.add('-translate-x-full');
    }
  };

  useEffect(() => {
    if (selectedType === '1') {
      const fetchPresetData = async () => {
        const data = await fetchData(`${host}/pr/data/presets/circuit`);
        setTempPreset(0);
      };
      fetchPresetData();
      setPreset(tempPreset);
    }

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [selectedType]);

  useEffect(() => {
    setRegion('NA');
  }, [selectedType]);

  useEffect(() => {
    setPreset(tempPreset);
  }, [tempPreset]);

  const handleTypeChange = (e) => {
    setSelectedType(e.target.value);
    setPreset(0);
    setTourneyIds([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950">
      <div className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
        <button onClick={() => document.getElementById('logo-sidebar').classList.toggle('-translate-x-full')} aria-controls="logo-sidebar" type="button" className="inline-flex items-center p-2 text-sm text-gray-600 rounded-lg md:hidden hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700">
          <svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path clipRule="evenodd" fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"></path>
          </svg>
          <span className="ml-1">Filters</span>
        </button>
      </div>
      <div className="bg-gray-100 flex h-screen dark:bg-slate-950">
        <aside ref={sidebarRef} id="logo-sidebar" className="fixed inset-0 z-40 md:w-1/4 w-80 h-screen transition-transform -translate-x-full md:translate-x-0 bg-white dark:bg-gray-900 md:static overflow-y-auto shadow-lg scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 scrollbar-thumb-rounded-full scrollbar-track-rounded-full">
          <div className="h-full p-2">
            <div className="py-2">
              <h2 htmlFor="prType" className="block mb-2 text-base font-medium text-gray-900 dark:text-gray-400">These are estimates. They will not be 100% accurate, but they are as close as possible to what officials would look like, up until top 200</h2>
              <hr className="h-px my-2 bg-gray-300 border-0 dark:bg-gray-700" />
              <label htmlFor="prType" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-400">Tournament Type</label>
              <select id="prType" value={selectedType} onChange={handleTypeChange} className="block w-full px-4 py-3 text-base text-gray-900 border border-gray-400 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-500 dark:text-white dark:focus:ring-blue-700 dark:focus:border-blue-700">
                <option value="0">Official Tournaments</option>
                <option value="1">Brawlhalla Circuit</option>
                <option value="2">LAN Tournaments</option>
                <option value="3">Royales</option>
                <option value="4">Community Tournaments</option>
              </select>
            </div>
            <Sidebar
              selectedGamemode={selectedGamemode}
              setSelectedGamemode={setSelectedGamemode}
              dateDecay={dateDecay}
              setDateDecay={setDateDecay}
              minifyRank={minifyRank}
              setMinifyRank={setMinifyRank}
              showGamemode={selectedType === '0'}
              selectedType={selectedType}
              setPreset={setPreset}
              setRegion={setRegion}
              setTourneyIds={setTourneyIds}
              region={region} 
            />
          </div>
        </aside>
        <div id="rankings" className="w-full p-2 bg-gray-100 dark:bg-slate-950 overflow-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 scrollbar-thumb-rounded-full scrollbar-track-rounded-full">
          <RankingsList preset={preset} region={region} minifyRank={minifyRank} selectedType={selectedType} gamemode={selectedGamemode} dateDecay={dateDecay} tourneyIds={tourneyIds} />
        </div>
      </div>
    </div>
  );
};

export default PowerRankings;
