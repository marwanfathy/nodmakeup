import React, { useEffect, useState } from 'react';
import './welcome.css';

function WelcomeUser({ username, onAnimationEnd }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // 1. Wait 2 seconds so user can read the text
    const timer1 = setTimeout(() => {
      setFade(true); // Trigger the CSS fade out
    }, 2000);

    // 2. Wait for the fade animation (1s) to finish, then unmount
    const timer2 = setTimeout(() => {
      onAnimationEnd(); // Tell App.js to show the website now
    }, 2500); // 2000ms delay + 1000ms fade duration

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onAnimationEnd]);

  return (
    <div className={`welcome-user-container ${fade ? 'fade-out' : ''}`}>
      <div className="text-content">
        <h1>LUNCHING SOON</h1>
      </div>
    </div>
  );
}

export default WelcomeUser;