import React from 'react';  

import { host } from "../../stuff";

function LoginButton() {
  const backendLoginURL = `${host}/auth/login`;


  return (
    <a className="flex" href={backendLoginURL}>
      <button className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded ml-3">Login with start.gg</button>
    </a>
  );
}

export default LoginButton;
