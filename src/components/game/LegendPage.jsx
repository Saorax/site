import React, { useEffect, useState } from "react";
import moment from 'moment';
import '../../../fonts/style.css';

function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(typeof window !== 'undefined' && typeof navigator !== 'undefined');
  }, []);

  return isClient;
}

function NextPrevLegend({ legend, className }) {
  return (
    <a href={`/game/legends/${legend.bio.name.normal.toLowerCase()}`} className={`mx-1 text-white ${className}`} key={legend.bio.name.normal}>
      <div className="flex justify-center">
        <div className="flex flex-col">
          <img src={legend.weapons.main.image} className="max-w-8 h-8" alt="Main weapon" />
          <img src={legend.weapons.secondary.image} className="max-w-8 h-8" alt="Secondary weapon" />
        </div>
        <img src={legend.image} className="rounded-xl h-16 w-16" alt={legend.bio.name.normal} />
      </div>
      <div className="pr-0.5 flex flex-col ml-1.5 min-w-[20%]">
        <span className="text-sm font-normal">{legend.bio.aka.split(', ')[0]}</span>
        <span className="text-lg font-bold">{legend.bio.name.normal}</span>
        <span className="text-sm font-normal">{legend.release}</span>
      </div>
    </a>
  );
}

function MakeProfile({ legend, prevLegends, nextLegends }) {
  return (
    <div className="flex flex-col lg:flex-row items-center justify-evenly w-full py-2 space-y-2 lg:space-y-0">
      
      {/* prev next small */}
      <div className="flex justify-center lg:hidden w-full order-1">
        {prevLegends.map((prevLegend, index) => (
          <NextPrevLegend
            legend={prevLegend}
            key={prevLegend.bio.name.normal}
            className={`${index === 1 ? "flex" : "hidden"} w-1/2 text-white border border-gray-600 rounded-lg p-2 bg-gray-800 shadow-md`}
          />
        ))}
        {nextLegends.map((nextLegend, index) => (
          <NextPrevLegend
            legend={nextLegend}
            key={nextLegend.bio.name.normal}
            className={`${index === 0 ? "flex" : "hidden"} w-1/2 text-white border border-gray-600 rounded-lg p-2 bg-gray-800 shadow-md`}
          />
        ))}
      </div>

      {/* prev leg large */}
      <div className="hidden lg:flex justify-center lg:order-1">
        {prevLegends.map((prevLegend, index) => (
          <NextPrevLegend
            legend={prevLegend}
            key={prevLegend.bio.name.normal}
            className={`${index === 0 ? "hidden lg:flex" : "flex"} text-white border border-gray-600 rounded-lg p-1.5 bg-gray-800 shadow-md`}
          />
        ))}
      </div>

      {/*mainsd*/}
      <div className="flex h-full text-[0.875rem] text-zinc-600 dark:text-zinc-300 p-2 lg:order-2 order-2">
        <div className="flex items-center flex-col lg:flex-row">
          <div className="flex mt-2 lg:mt-0">
            <div>
              <img src={legend.weapons.main.image} className="w-12 h-12 lg:w-16 lg:h-16" alt="Main weapon" />
              <img src={legend.weapons.secondary.image} className="w-12 h-12 lg:w-16 lg:h-16" alt="Secondary weapon" />
            </div>
            <img src={legend.image} className="rounded-xl h-24 w-24 lg:h-32 lg:w-32 mx-4" alt={legend.bio.name.normal} />
          </div>
          
          <div className="pr-3 flex flex-col min-w-[20%] text-center lg:text-left">
            <span className="text-lg lg:text-xl font-normal">{legend.bio.aka}</span>
            <span className="text-3xl lg:text-4xl font-bold">{legend.bio.name.normal}</span>
            <span className="text-base lg:text-lg font-normal">CodeName: {legend.codeName}</span>
            <span className="text-sm lg:text-xl font-normal">{legend.releaseDate}</span>
          </div>
          
        </div>
      </div>

      {/* next leg large*/}
      <div className="hidden lg:flex justify-center lg:order-3">
        {nextLegends.map((nextLegend, index) => (
          <NextPrevLegend
            legend={nextLegend}
            key={nextLegend.bio.name.normal}
            className={`${index === 1 ? "hidden lg:flex" : "flex"} mx-2 text-white border border-gray-600 rounded-lg p-2 bg-gray-800 shadow-md`}
          />
        ))}
      </div>
    </div>
  );
}

function LegendSkins({ legend, history}) {
  console.log(legend)

  return (<div>
    test
  </div>)
}

const LegendPage = ({ legend, prevLegends, nextLegends, history }) => {
  const isClient = useIsClient();
  const [currentTab, setCurrentTab] = useState("main");
  const [currentStance, setCurrentStance] = useState("base");
  const ste = ['str', 'dex', 'def', 'spe'];
  const steDlc = ['Strength', 'Dexterity', 'Weight', 'Speed'];
  const stanceChanges = legend.stances.stanceChanges;

  const releaseDate = isClient
    ? new Date(legend.release).toLocaleString(navigator.language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      ` (${((new Date() - new Date(legend.release)) / (1000 * 3600 * 24)).toFixed()} days ago)`
    : "";

  const compareToBase = (value, base, int) => {
    if (int == 0 && value >= 1) return "742";
    if (int == 9 && value < 10) return "753";
    if (int == 9 && value == 10) return "751";
    if (value == base && value >= int + 1) return "745";
    if (value > base && value == int + 1) return "746";
    if (value < base && value == int) return "747";
    if (value >= int + 1) return "745";
    return "749";
  };

  const handleStanceToggle = (stance) => {
    setCurrentStance(currentStance === stance ? "base" : stance);
  };

  const currentStanceData =
    currentStance === "base"
      ? legend.stances
      : stanceChanges[currentStance]
      ? Object.fromEntries(ste.map((shortKey, idx) => [shortKey, stanceChanges[currentStance][steDlc[idx]]]))
      : legend.stances;

  return (
    <div style={{ fontFamily: 'BHSlim, sans-serif' }} className="flex flex-col dark:text-white text-black">
      <MakeProfile legend={{ ...legend, releaseDate }} prevLegends={prevLegends} nextLegends={nextLegends} />

      <div className="text-2xl flex justify-center space-x-8 border-b border-gray-500">
        <button onClick={() => setCurrentTab("main")} className={`py-2 ${currentTab === "main" ? "border-b-2 border-blue-500" : ""}`}>Main Page</button>
        <button onClick={() => setCurrentTab("skins")} className={`py-2 ${currentTab === "skins" ? "border-b-2 border-blue-500" : ""}`}>Skins</button>
        <button onClick={() => setCurrentTab("history")} className={`py-2 ${currentTab === "history" ? "border-b-2 border-blue-500" : ""}`}>Historical Changes</button>
      </div>

      {currentTab === "main" && (
        <div id="main-content" className="w-full flex flex-col lg:flex-row items-center lg:items-start p-2 space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex flex-col bg-slate-800 rounded-2xl p-4 w-full lg:w-auto">
            <span className="text-2xl lg:text-3xl font-bold text-center capitalize">
              {currentStance === "base" ? "Base Stance" : `${steDlc[ste.indexOf(currentStance)] === 'Weight' ? 'Defense' : steDlc[ste.indexOf(currentStance)]} Stance`}
            </span>
            <div className="flex lg:flex-row items-center justify-center mt-4">
              <div className="flex flex-col mr-1">
                {ste.map(r => (
                  <div className="flex my-0.5 cursor-pointer" key={r} onClick={() => handleStanceToggle(r)}>
                    <img
                      src={`/game/${r === 'def' ? 'defense' : r === 'dex' ? 'dexterity' : r === 'spe' ? 'speed' : 'attack'}.png`}
                      className={`h-6 w-7 lg:h-7 lg:w-8 ${currentStance === r ? 'opacity-100' : 'opacity-50'}`}
                      alt="Stat icon"
                    />
                  </div>
                ))}
              </div>
              <div className="ml-1 flex flex-col">
                {ste.map((attribute, idx) => (
                  <div className="flex my-0.5" key={attribute}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <img key={i} src={`/game/${compareToBase(currentStanceData[attribute], legend.stances[attribute], i)}.png`} className="h-6 w-5 lg:h-7 lg:w-6" alt="Stat level" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:space-x-4 w-[90%] p-3 bg-slate-900 rounded-xl">
            <div className="w-full lg:w-3/4 pr-0 lg:pr-4">
              <div className="flex flex-wrap justify-center lg:justify-normal mb-2">
                {legend.missionTagsFull.map((tag, index) => (
                  <span key={index} className="bg-gray-700 text-white px-3 py-1 m-1 rounded-full text-sm">{tag}</span>
                ))}
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100">Biography</h2>
              <p className="text-lg lg:text-xl text-gray-700 dark:text-gray-300 mt-4">{legend.bio.text}</p>
            </div>
            <div className="flex flex-col space-y-4 w-full lg:w-1/4 mt-4 lg:mt-0">
              {[legend.bio.quote, legend.bio.quote2].map((quote, index) => (
                <div key={index} className="p-4 rounded-2xl border-4 border-slate-500 bg-slate-800">
                  <p className="text-xl lg:text-2xl text-center text-gray-100 italic">“{quote.text}”</p>
                  <p className="text-md lg:text-lg font-semibold text-right mt-4 text-gray-400">{quote.attrib}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentTab === "skins" && (
        <div className="p-2">
          <LegendSkins legend={legend} history={history}/>
        </div>
      )}

      {currentTab === "history" && (
        <div className="p-2"></div>
      )}
    </div>
  );
};

export default LegendPage;
