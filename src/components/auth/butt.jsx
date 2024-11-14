import React from 'react';

function LoginButton() {
  const backendLoginURL = 'http://localhost:3001/auth/login';


  return (
    <a href={backendLoginURL}>
      <button style={{ padding: '10px', backgroundColor: '#FF5C5C', color: 'white' }}>Login with start.gg</button>
    </a>
  );
}

export default LoginButton;
