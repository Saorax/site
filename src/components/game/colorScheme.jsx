import { host } from '../../stuff';
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import html2canvas from 'html2canvas';

const fetchColors = async () => {
  const response = await fetch(host + '/game/colors');
  const result = await response.json();
  return result;
};
function mid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
function cook(id) {
  const cookie = document.cookie.split('; ').find(row => row.startsWith('co='));
  if (cookie) {
    const value = cookie.split('=')[1];
    if (value === 'true') {
      setCooldown(true);
    }
  } else {
    document.cookie = `co=${mid(20)};`;
  }
}
const fetchCustomColorsList = async () => {
  const response = await fetch(host + '/game/colors/list');
  const result = await response.json();
  return result;
};

const fetchCustomColors = async (internal) => {
  const response = await fetch(`${host}/game/colors/${internal}`);
  const result = await response.json();
  return result;
};

const fetchLegend = async (id, legendCache) => {
  if (legendCache.current[id]) {
    return legendCache.current[id];
  }

  const response = await fetch(`${host}/game/legends/${id}`);
  const result = await response.json();
  legendCache.current[id] = result;
  return result;
};

const saveAsPng = async () => {
  const button = document.getElementById('saveButton');
  button.disabled = true;
  button.innerHTML = 'Saving...';

  const finalColorDiv = document.getElementById('finalColor');
  html2canvas(finalColorDiv, { backgroundColor: null, useCORS: true }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'color_scheme.png';
    link.href = canvas.toDataURL('image/png', 5.0);
    link.click();
    button.disabled = false;
    button.innerHTML = 'Save as PNG';
  });
};

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center">
      <div className="w-16 h-16 border-t-4 border-b-4 border-cyan-500 rounded-full animate-spin"></div>
    </div>
  );
}

function GetSkinList({ main, skin, legendData, legendCache }) {
  const skinData = legendData.skins[skin];
  const skinName = skin === 0 && !main.includes('_mod') ? `Default ${legendData.bio.name.normal}` : skinData.name;
  return (
    <div id={`${main}-${skin}`} onClick={(e) => setColorDiv(e, legendCache)} className="w-30 sm:w-64 h-30 sm:h-64 flex flex-col items-center cursor-pointer rounded-lg transition duration-300 ease-linear hover:bg-gray-200 dark:hover:bg-gray-700 shadow-lg">
      <img
        id={`${main}-${skin}`}
        src={`${host}/game/legends/${main.includes('_mod') ? main.split('_')[0] : main}/${skin}/create${main.includes('_mod') ? '/true' : ''}`}
        className="h-24 sm:h-56 w-24 sm:w-56 rounded-lg transition duration-300 ease-linear"
      />
      <span id={`${main}-${skin}`} className="text-xs sm:text-xl text-gray-800 dark:text-cyan-200 text-center">{skinName}</span>
    </div>
  );
}

function ColorList({ main, skin, legendCache }) {
  const handleColorClick = async () => {
    await makeAttribs({ target: { id: `${main.ColorSchemeID}-${skin}` } }, legendCache);
    applyColorsToSvg(main);
  };
  const getContrastingTextColor = (bgColor) => {
    if (!bgColor) return '#000';
    const color = bgColor.charAt(0) === '#' ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const uicolors = [r / 255, g / 255, b / 255];
    const c = uicolors.map((col) => {
      if (col <= 0.03928) {
        return col / 12.92;
      }
      return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.179 ? '#000' : '#FFF';
  };

  const adjustBrightness = (color, amount) => {
    let usePound = false;
    if (color[0] === '#') {
      color = color.slice(1);
      usePound = true;
    }
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let g = ((num >> 8) & 0x00FF) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    let b = (num & 0x0000FF) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    return (usePound ? '#' : '') + (r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0'));
  };

  const bgColor = main.IndicatorColor ? main.IndicatorColor.replace('0x', '#').toLocaleLowerCase() : '#444';
  const textColor = getContrastingTextColor(bgColor);
  const hoverBgColor = adjustBrightness(bgColor, -20);

  return (
    <div
      id={`${main.ColorSchemeID}-${skin}`}
      onClick={handleColorClick}
      className="cursor-pointer rounded-lg transition duration-300 ease-linear p-1.5 shadow-md"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <span className="text-lg" style={{ color: textColor }}>{main.DisplayName}</span>
      <style jsx>{`
        #${main.ColorSchemeID}-${skin}:hover {
          background-color: ${hoverBgColor};
        }
      `}</style>
    </div>
  );
}

const copyToClipboard = () => {
  const colorAttrContent = document.getElementById('colorAttrContent');
  const textToCopy = Array.from(colorAttrContent.querySelectorAll('input'))
    .map(input => `${input.title}: ${input.value}`)
    .join('\n');

  navigator.clipboard.writeText(textToCopy).then(() => {
    alert('Copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy text: ', err);
  });
};

const pasteFromClipboard = async () => {
  const clipboardText = await navigator.clipboard.readText();
  const colorMap = clipboardText.split('\n').reduce((acc, line) => {
    const [key, value] = line.split(': ');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});

  const inputs = document.querySelectorAll('#colorAttrContent input');
  inputs.forEach(input => {
    if (colorMap[input.title]) {
      input.value = colorMap[input.title];
      handleColorChange({ target: { value: colorMap[input.title] } }, input.title);
    }
  });
};

async function makeAttribs(event, legendCache) {
  const id = event.target.id || event.target.parentElement.id;
  const main = document.getElementById('colorAttrContent');
  main.innerHTML = '';

  const colors = JSON.parse(sessionStorage.getItem('colors')) || [];
  const customColorsList = JSON.parse(sessionStorage.getItem('customColorsList')) || [];
  const customColors = JSON.parse(sessionStorage.getItem('customColors')) || [];
  let colorPick = colors.find(r => r.ColorSchemeID === id.split('-')[0]) || customColors.flat().find(r => r.ColorSchemeID === id.split('-')[0]);

  const legendData = await fetchLegend(id.split('-')[1], legendCache);

  if (id.split('-')[0] === '0') {
    colorPick = {
      ...legendData.skins[id.split('-')[2]].pieces,
      ColorSchemeName: 'Default',
      DisplayName: 'Default Color Scheme',
      ColorSchemeID: 0,
    };
    for (let obs in colorPick) {
      if (obs.includes('_Swap')) delete colorPick[obs];
    }
  } else {
    for (let obs in colorPick) {
      if (obs.includes('_Define')) delete colorPick[obs];
    }
  }

  const colorDiv = Object.keys(colorPick)
    .filter(key => (key.includes('_Swap') || key.includes('_Define')) && colorPick[key] !== '' && colorPick[key].toLocaleLowerCase().includes('0x'))
    .map(key => {
      if (colorPick.ColorSchemeID !== 0 && legendData.skins[id.split('-')[2]].pieces.hasOwnProperty(key.replace('_Swap', '_Define')) && legendData.skins[id.split('-')[2]].pieces[key.replace('_Swap', '_Define')] === '') {
        return null;
      }
      return (
        <div key={key.split('_')[0]} className="gap-4 grid grid-cols-2 items-center mb-2">
          <label htmlFor={`color-${key.split('_')[0]}`} className="text-base font-medium text-gray-800 dark:text-cyan-200 w-32">{key.split('_')[0]}</label>
          <input
            type="color"
            className="p-1 h-10 w-16 bg-gray-200 border border-gray-400 cursor-pointer rounded-lg dark:bg-neutral-900"
            id={`color-${key.split('_')[0]}`}
            defaultValue={colorPick[key].toLocaleLowerCase().replace('0x', '#').toLocaleLowerCase()}
            title={key.split('_')[0]}
            onChange={(e) => handleColorChange(e, key.split('_')[0])}
          />
        </div>
      );
    });

  createRoot(main).render(
    <div className="flex flex-col p-2">
      <span className="text-center text-3xl font-semibold mb-2 text-gray-800 dark:text-cyan-200">{colorPick.DisplayName}</span>
      <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 grid grid-cols-2">{colorDiv}</div>
      <button onClick={copyToClipboard} className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded">Copy to Clipboard</button>
      <button onClick={pasteFromClipboard} className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded">Paste from Clipboard</button>
      <SubmitColorForm colorScheme={colorPick} />
    </div>
  );
}

const handleColorChange = (event, key) => {
  const colorValue = event.target.value;
  const paths = document.getElementsByTagName('path');
  const gradients = document.getElementsByTagName('stop');
  const all = [...paths, ...gradients];
  for (let i = 0; i < all.length; i++) {
    if (all[i].id === key.split('_')[0]) {
      if (all[i].getAttribute('fill') !== null) all[i].setAttribute('fill', colorValue);
      else all[i].setAttribute('stop-color', colorValue);
    }
  }
};

const applyColorsToSvg = (colorScheme) => {
  const colorMap = {};
  Object.keys(colorScheme).forEach(key => {
    if (key.includes('_Swap') || key.includes('_Define')) {
      colorMap[key.split('_')[0]] = colorScheme[key].toLocaleLowerCase().replace('0x', '#').toLocaleLowerCase();
    }
  });

  const paths = document.getElementsByTagName('path');
  const gradients = document.getElementsByTagName('stop');
  const all = [...paths, ...gradients];

  for (let i = 0; i < all.length; i++) {
    const elementId = all[i].id.split('_')[0];
    if (colorMap[elementId]) {
      if (all[i].getAttribute('fill') !== null) all[i].setAttribute('fill', colorMap[elementId]);
      else all[i].setAttribute('stop-color', colorMap[elementId]);
    }
  }
};

async function getHistory(event, legendCache) {
  const id = event.target.id || event.target.parentElement.id;
  const main = document.getElementById('colorSchemeContent');
  main.innerHTML = '<div className="flex justify-center items-center h-full"><LoadingSpinner /></div>';

  const legendData = await fetchLegend(id, legendCache);

  createRoot(main).render(
    <div className="w-full h-screen dark:bg-gray-900">
      <div className="gap-2 flex flex-col md:flex-row w-full text-sm text-gray-300 dark:text-zinc-200 rounded-lg pb-2">
        <div className="flex flex-col items-center md:items-start w-full md:w-1/5 mb-4 md:mb-0 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
          <img src={legendData.image} className="rounded-xl h-24 w-24 md:h-52 md:w-52" alt={legendData.bio.name.normal} />
          <span className="text-xl md:text-4xl font-bold mt-2 text-gray-800 dark:text-cyan-200">{legendData.bio.name.normal}</span>
        </div>
        <div className="flex flex-wrap justify-center md:flex-col w-full overflow-y-auto max-h-80 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800">
          {legendData.skins.map((_, i) => <GetSkinList key={i} main={legendData.id} skin={i} legendData={legendData} legendCache={legendCache} />)}
        </div>
      </div>
      <div id="colorData" className="h-full"></div>
    </div>
  );
}

async function crossoverDiv(event, legendCache) {
  const id = event.target.id || event.target.parentElement.id;
  const main = document.getElementById('colorSchemeContent');
  main.innerHTML = '<div className="flex justify-center items-center h-full"><LoadingSpinner /></div>';

  const legendData = await fetchLegend(id, legendCache);

  await createRoot(main).render(
    <div className="w-full h-screen dark:bg-gray-900">
      <div id="colorData" className="h-full"></div>
    </div>
  );
  await setColorDiv(event, legendCache);
}

async function setColorDiv(event, legendCache) {
  const id = event.target.id || event.target.parentElement.id;
  const main = document.getElementById('colorData');
  main.innerHTML = '<div className="flex justify-center items-center h-full"><LoadingSpinner /></div>';

  const colors = JSON.parse(sessionStorage.getItem('colors')) || [];
  const customColorsList = JSON.parse(sessionStorage.getItem('customColorsList')) || [];
  const customColors = JSON.parse(sessionStorage.getItem('customColors')) || [];
  const legendData = await fetchLegend(id.split('-')[0], legendCache);
  const skinPieces = legendData.skins[id.split('-')[1]].pieces;
  for (let obj in skinPieces) {
    if (obj.includes('_Swap') && skinPieces[obj] !== '') {
      if (skinPieces[obj].includes('0x')) {
        skinPieces[obj.replace('_Swap', '_Define')] = skinPieces[obj];
      } else {
        skinPieces[obj.replace('_Swap', '_Define')] = skinPieces[skinPieces[obj] + '_Define'];
        delete skinPieces[obj.replace('_Swap', '_Define')];
      }
    }
  }
  const svgResponse = await fetch(`${host}/game/legends/${id.split('-')[0].replace('_mod', '')}/${id.split('-')[1]}/svg/${window.innerWidth < 768}${id.includes('_mod') ? '/true' : ''}`);
  const svgData = await svgResponse.json().then(res => res.data);
  const custo = [
    {
      ...skinPieces,
      ColorSchemeName: 'Default',
      DisplayName: 'Default Colors',
      ColorSchemeID: 0,
    },
    ...colors
  ];

  const colorDiv = Object.keys(skinPieces)
    .filter(key => key.includes('_Define') && skinPieces[key] !== '' && skinPieces[key].toLocaleLowerCase().includes('0x'))
    .map(key => (
      <div key={key.split('_')[0]} className="gap-4 grid grid-cols-2 items-center mb-2">
        <label htmlFor={`color-${key.split('_')[0]}`} className="text-base font-medium text-gray-800 dark:text-cyan-200">{key.split('_')[0]}</label>
        <input
          type="color"
          className="p-1 h-10 w-16 bg-gray-200 border border-gray-400 cursor-pointer rounded-lg dark:bg-neutral-900"
          id={`color-${key.split('_')[0]}`}
          defaultValue={skinPieces[key].toLocaleLowerCase().replace('0x', '#').toLocaleLowerCase()}
          title={key.split('_')[0]}
          onChange={(e) => handleColorChange(e, key.split('_')[0])}
        />
      </div>
    ));
  createRoot(main).render(
    <div className="w-full h-full dark:bg-gray-900">
      <div className="flex h-auto md:h-full flex-col md:flex-row gap-4">
        <div className="w-full md:w-[20%] bg-gray-100 dark:bg-gray-800 p-2 rounded-lg overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 shadow-lg">
          <h2 className="text-center text-3xl font-semibold mb-2 text-gray-800 dark:text-cyan-200">Colors</h2>
          <div className="overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 max-h-screen">
            <Disclosure>
              {({ open }) => (
                <>
                  <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-lg font-medium text-left text-gray-300 dark:text-cyan-200 bg-cyan-900 rounded-lg hover:bg-cyan-800 focus:outline-none focus-visible:ring focus-visible:ring-cyan-500 focus-visible:ring-opacity-75 shadow-md">
                    <span>Official Colors</span>
                    {open ? <ChevronUpIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" /> : <ChevronDownIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" />}
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-1 pt-1 pb-1 text-sm text-gray-500 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 max-h-80 overflow-y-auto">
                    {custo.map((color, i) => <ColorList key={i} main={color} skin={id} legendCache={legendCache} />)}
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>
            {customColorsList.map((customColor, i) => (
              <Disclosure key={i}>
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-lg font-medium text-left text-gray-300 dark:text-cyan-200 bg-cyan-900 rounded-lg hover:bg-cyan-800 focus:outline-none focus-visible:ring focus-visible:ring-cyan-500 focus-visible:ring-opacity-75 shadow-md">
                      <span>{customColor.full}</span>
                      {open ? <ChevronUpIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" /> : <ChevronDownIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" />}
                    </Disclosure.Button>
                    <Disclosure.Panel className="px-1 pt-1 pb-1 text-sm text-gray-500 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 max-h-80 overflow-y-auto">
                      {customColors[i].map((color, j) => <ColorList key={j} main={color} skin={id} legendCache={legendCache} />)}
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            ))}
          </div>
        </div>
        <div className="w-full h-full md:w-[30%] bg-gray-100 dark:bg-gray-800 p-2 rounded-lg overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 shadow-lg">
          <div className="flex h-full flex-col">
            <div id="colorAttrContent" className="grid grid-cols-1 gap-2 mb-2">
              <div className="flex flex-col p-2">
                <span className="text-center text-3xl font-semibold mb-2 text-gray-800 dark:text-cyan-200">Default Color Scheme</span>
                <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 grid grid-cols-2">{colorDiv}</div>
                <button onClick={copyToClipboard} className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded">Copy to Clipboard</button>
                <button onClick={pasteFromClipboard} className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded">Paste from Clipboard</button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg shadow-lg w-full md:w-[50%]">
          <button
            id="saveButton"
            onClick={saveAsPng}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded"
          >
            Save as PNG
          </button>
          <div id="finalColor" className="w-full h-full mt-3 flex-grow overflow-hidden">
            {id.includes('_mod') ? (
              <div className='text-lg text-center flex flex-col dark:text-gray-100 text-gray-800'>
                <span className='text-2xl'>{legendData.skins[id.split('-')[1]].name}</span>
                <span className=''>Created by {legendData.skins[id.split('-')[1]].createdBy} ~ Commissioned by {legendData.skins[id.split('-')[1]].commissioner}</span>
                <a className="dark:text-sky-400 text-sky-600" href={legendData.skins[id.split('-')[1]].link} target="_blank" rel="noopener noreferrer">GameBanana Link</a>
              </div>
            ) : null}
            <div className="w-full h-screen svg-container" style={{ overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: svgData }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendCard({ data, onClick }) {
  return (
    <div id={data.id} onClick={onClick} className="cursor-pointer flex flex-col items-center text-center rounded-lg p-2 transition duration-300 ease-linear hover:bg-gray-200 dark:hover:bg-gray-700 shadow-md">
      <div id={data.id} className="text-base text-gray-800 dark:text-gray-200 flex flex-col items-center">
        <img id={data.id} src={data.image} className="rounded-lg h-12 w-12 mb-2" alt={data.bio ? data.bio.name.normal : data.name} />
        <span id={data.id} className="text-xs sm:text-base">{data.bio ? data.bio.name.normal : data.name}</span>
      </div>
    </div>
  );
}

function MainLegends({ data, legendCache }) {
  return <LegendCard data={data} onClick={(e) => getHistory(e, legendCache)} />;
}

function CrossoverLegends({ data, legendCache }) {
  return <LegendCard data={data} onClick={(e) => crossoverDiv(e, legendCache)} />;
}

function SubmitColorForm({ colorScheme }) {
  const [name, setName] = useState('');
  const [cooldown, setCooldown] = useState(false);

  const handleSubmitColor = async () => {
    if (cooldown) {
      alert('You can only submit one color scheme per day.');
      return;
    }

    try {
      const response = await fetch(host + '/game/colors/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          colors: colorScheme,
        }),
      });

      if (response.ok) {
        alert('Color scheme submitted successfully!');
        setCooldown(true);
        setTimeout(() => setCooldown(false), 86400000);
        const colors = await fetchColors();
        sessionStorage.setItem('colors', JSON.stringify(colors));
      } else {
        alert('Failed to submit color scheme.');
      }
    } catch (error) {
      console.error('Error submitting color scheme:', error);
      alert('Error submitting color scheme.');
    }
  };

  return (
    <div className="flex flex-col p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md mt-4">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-cyan-200 mb-4">Submit Your Color Scheme</h2>
      <input
        type="text"
        placeholder="Color Scheme Name"
        className="p-2 mb-2 bg-white border border-gray-300 rounded-lg dark:bg-neutral-900 dark:border-gray-700"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        onClick={handleSubmitColor}
        className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded"
      >
        Submit
      </button>
    </div>
  );
}

export default function ColorSchemeSite() {
  const [mainLegends, setMainLegends] = useState([]);
  const [crossoverLegends, setCrossoverLegends] = useState([]);
  const [customLegends, setCustomLegends] = useState([]);
  const legendCache = useRef({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(host + '/game/legends/all').then(res => res.json());
        const response2 = await fetch(host + '/game/legends/crossover').then(res => res.json());
        const response3 = await fetch(host + '/game/legends/mods/all').then(res => res.json());
        const colors = await fetchColors();
        const customColorsList = await fetchCustomColorsList();
        const customColors = await Promise.all(customColorsList.map(color => fetchCustomColors(color.internal)));

        sessionStorage.setItem('colors', JSON.stringify(colors));
        sessionStorage.setItem('customColorsList', JSON.stringify(customColorsList));
        sessionStorage.setItem('customColors', JSON.stringify(customColors));

        setMainLegends(response);
        setCrossoverLegends(response2);
        setCustomLegends(response3);
        response.forEach(legend => {
          legendCache.current[legend.id] = legend;
        });
        response2.forEach(legend => {
          legendCache.current[legend.id] = legend;
        });
        response3.forEach(legend => {
          legendCache.current[legend.id] = legend;
        });
      } catch (error) {
        console.error(error.message);
      }
    };
    fetchData();
  }, []);

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

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col md:flex-row overflow-y-auto h-screen dark:bg-gray-900">
      <div className="w-full md:w-1/6 text-gray-300 bg-gray-100 dark:bg-gray-800 p-2 space-y-2 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800">
        <Disclosure>
          {({ open }) => (
            <>
              <Disclosure.Button className="flex justify-between w-full px-2 py-1 text-2xl font-medium text-left text-gray-300 dark:text-cyan-200 bg-cyan-900 dark:bg-gray-700 rounded-lg hover:bg-cyan-800 focus:outline-none focus-visible:ring focus-visible:ring-cyan-500 focus-visible:ring-opacity-75 shadow-lg">
                <span>Main Legends</span>
                {open ? <ChevronUpIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" /> : <ChevronDownIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" />}
              </Disclosure.Button>
              <Disclosure.Panel className="overflow-x-hidden text-sm text-gray-500 grid grid-cols-3 gap-2 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 max-h-64 overflow-y-auto">
                {mainLegends.map((item, i) => <MainLegends key={i} data={item} legendCache={legendCache} />)}
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
        <Disclosure>
          {({ open }) => (
            <>
              <Disclosure.Button className="flex justify-between w-full px-2 py-1 text-2xl font-medium text-left text-gray-300 dark:text-cyan-200 bg-cyan-900 dark:bg-gray-700 rounded-lg hover:bg-cyan-800 focus:outline-none focus-visible:ring focus-visible:ring-cyan-500 focus-visible:ring-opacity-75 shadow-lg">
                <span>Crossovers</span>
                {open ? <ChevronUpIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" /> : <ChevronDownIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" />}
              </Disclosure.Button>
              <Disclosure.Panel className="overflow-x-hidden text-sm text-gray-500 grid grid-cols-3 gap-2 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 max-h-64 overflow-y-auto">
                {crossoverLegends.map((item, i) => <CrossoverLegends key={i} data={item} legendCache={legendCache} />)}
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
        <Disclosure>
          {({ open }) => (
            <>
              <Disclosure.Button className="flex justify-between w-full px-2 py-1 text-2xl font-medium text-left text-gray-300 dark:text-cyan-200 bg-cyan-900 dark:bg-gray-700 rounded-lg hover:bg-cyan-800 focus:outline-none focus-visible:ring focus-visible:ring-cyan-500 focus-visible:ring-opacity-75 shadow-lg">
                <span>Custom Legends</span>
                {open ? <ChevronUpIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" /> : <ChevronDownIcon className="w-5 h-5 text-gray-300 dark:text-cyan-200" />}
              </Disclosure.Button>
              <Disclosure.Panel className="overflow-x-hidden text-sm text-gray-500 grid grid-cols-3 gap-2 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800 max-h-64 overflow-y-auto ">
                {customLegends.map((item, i) => <MainLegends key={i} data={item} legendCache={legendCache} />)}
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      </div>
      <div className="w-full md:w-5/6  p-2 dark:bg-gray-900 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-gray-800" id="colorSchemeContent"></div>
    </div>
  );
}
