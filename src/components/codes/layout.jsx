import React, { useState, useEffect, useRef } from 'react';
import { Disclosure, RadioGroup } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { FaTwitter, FaTwitch } from 'react-icons/fa';
import 'tailwindcss/tailwind.css';
import 'tailwind-scrollbar';
import { host } from "../../stuff";
const fetchData2 = async (url) => {
  const res = await fetch(url);
  const data = await res.json();
  return data;
};

function MakeTable(data) {
  data = data.data
  return (
  <div className="flex border-2 rounded-2xl m-1 p-1 border-neutral-500">
    <div className='w-[60%] text-center justify-center items-center'>
      <img
        src={data.image}
        className="w-full bg-cover h-auto"
      />
      <div className=" text-center justify-center items-center w-full">
        <p className="text-base font-bold">{data.name}</p>
        <p className="text-base">{data.codeNum} codes</p>
      </div>
    </div>
    <div className="flex w-[40%] min-h-[25%]">
      <textarea
        rows="10"
        cols="15"
        readOnly
        value={data.codes.join('\n')}
        className="scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-slate-700 font-light font-mono bg-gray-800"
        style={{ resize: 'none' }}
      />
    </div>
  </div>)
};
const CodeDatabase = () => {
  const [allCodes, setAllCodes] = useState([]);
  const [usedCodes, setUsedCodes] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      const response = await fetchData2(host + '/codes/list/all');
      const response2 = await fetchData2(host + '/codes/list/used');
      setAllCodes(response);
      setUsedCodes(response2);
    };
    fetchData();
  }, []);
  console.log(allCodes)
  console.log(usedCodes)
  return (
    <div class=' p-1 text-white bg-slate-900 grid grid-cols-4'>{allCodes.map(r =>
      <MakeTable data={r} used={usedCodes} />)}</div>
  );
};

export default CodeDatabase;
