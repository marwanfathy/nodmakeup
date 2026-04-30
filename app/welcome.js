import React from 'react';
import './welcome.css';

function WelcomeUser() {
  // Removed useEffect and timers so it stays forever
  return (
    <div className="welcome-user-container"> 
      <div className="text-content">
        <h1>LAUNCHING SOON</h1>
      </div>
    </div>
  );
}

export default WelcomeUser;