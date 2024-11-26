import React from 'react';

import { host } from "../../stuff";
function LoginButton() {
  const backendLoginURL = `${host}/auth/login`;


  return (
    <a href={backendLoginURL}>
      <button style={{ padding: '10px', backgroundColor: '#FF5C5C', color: 'white' }}>Login with start.gg</button>
    </a>
  );
}

export default LoginButton;
