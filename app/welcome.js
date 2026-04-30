// welcome.js
import React, { useEffect, useState } from 'react';
import './welcome.css';

function WelcomeUser({ username, onAnimationEnd }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setFade(true);
    }, 2000);

    const timer2 = setTimeout(() => {
      // ADD THIS CHECK: Only call if the prop was provided
      if (onAnimationEnd) {
        onAnimationEnd();
      }
    }, 3000); // Increased slightly to allow full 1s fade

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onAnimationEnd]);

  return (
    <div className={`welcome-user-container ${fade ? 'fade-out' : ''}`}>
      <div className="text-content">
        <h1>LAUNCHING SOON</h1> {/* Fixed typo from LUNCHING */}
      </div>
    </div>
  );
}

export default WelcomeUser;