import React, { useState, useEffect, useRef } from 'react';
import { Disclosure, RadioGroup } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { FaTwitter, FaTwitch } from 'react-icons/fa';
import moment from 'moment';
import 'tailwindcss/tailwind.css';
import 'tailwind-scrollbar';
import { host } from "../../stuff";
const fetchData2 = async (url) => {
  const res = await fetch(url);
  const data = await res.json();
  return data;
};
const fetchPostData = async (url, body) => {
  let cook = document.cookie.split('; ').find(row => row.startsWith('gfd='));
  let mx = document.cookie.split('; ').find(row => row.startsWith('mx='));
  if (cook) cook = parseFloat(cook.split('=')[1]);
  if (mx) mx = parseFloat(mx.split('=')[1]);
  
  const aa = moment.duration(cook - new Date().getTime());
  if (cook > new Date().getTime() && mx >= 10) {
    document.getElementById('text-'+body.int1).value = `please wait ${aa.minutes() > 0 ? `${aa.minutes()}m ${aa.seconds()}s` : `${aa.seconds()}s`}`
    return null
  };
  if (((10 - mx) - body.int2) < 0) body.int2 = 10 - mx;
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  const data = await res.json();
  document.cookie = `gfd=${new Date().getTime() + 300000};`;
  document.cookie = `mx=${mx ? mx + body.int2 : body.int2};`
  return data;
};
async function copyCodes(int1, int2) {
  const data = await fetchPostData(host + '/codes/list/cop', {
    int1: int1, int2: int2
  });
  if (data !== null) {
    document.getElementById('text-'+int1).value = data.join('\n')
    navigator.clipboard.writeText(data.join('\n'));
  }
  return data;
}
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
    
    <div className="flex flex-col w-[40%] min-h-[25%]">
      <textarea
        rows="10"
        cols="15"
        readOnly
        id={'text-'+data.inte}
        value={'press the button below to copy 10 codes'}
        className="scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-slate-700 font-light font-mono bg-gray-800"
        style={{ resize: 'none' }}
      />
      <button onClick={async () => copyCodes(data.inte, 1)}>
        Get 1 Code
      </button>
      <button onClick={async () => copyCodes(data.inte, 5)}>
        Get 5 Codes
      </button>
    </div>

  </div>)
};
const CodeDatabase = () => {
  const [allCodes, setAllCodes] = useState([]);
  const [usedLength, setUsedLength] = useState();
  useEffect(() => {
    const fetchData = async () => {
      const response = await fetchData2(host + '/codes/list/all');
      const response2 = await fetchData2(host + '/codes/list/usedLength');
      setAllCodes(response);
      setUsedLength(response2.length);
    };
    fetchData();
  }, []);
  return (
    <div class=' text-white'>
      <div className='flex flex-col p-2 text-center text-3xl font-bold'>
        <span>Limit of 10 Codes every 5 minutes</span>
        <span>{usedLength} used codes</span>
      </div>
      <div className=' bg-slate-900 grid grid-cols-4'>
        {allCodes.map(r => <MakeTable data={r} />)}
      </div></div>
  );
};

export default CodeDatabase;
