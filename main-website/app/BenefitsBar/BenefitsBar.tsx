'use client';

import React from 'react';
import './BenefitsBar.css';

const benefitsData = [
  {
    id: 1,
    text: "FREE SHIPPING FROM 1500 EGP",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
      </svg>
    )
  },
  {
    id: 2,
    text: "FAST DELIVERY",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
        <path d="M12 2v2"></path>
        <path d="M12 22v-2"></path>
        <path d="M22 12h-2"></path>
        <path d="M2 12h2"></path>
        <path d="M16 4l-1.5 1.5"></path>
      </svg>
    )
  },
  {
    id: 3,
    text: "EASY RETURNS IN 14 DAYS",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74"></path>
        <rect x="8" y="8" width="8" height="8" rx="1"></rect>
      </svg>
    )
  },
  {
    id: 4,
    text: "GIFTS & OFFERS WITH nod",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12"></polyline>
        <rect x="2" y="7" width="20" height="5"></rect>
        <line x1="12" y1="22" x2="12" y2="7"></line>
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
      </svg>
    )
  }
];

const BenefitsBar = () => {
  return (
    <section className="benefits-bar-container">
      <div className="benefits-wrapper">
        {benefitsData.map((item) => (
          <div key={item.id} className="benefit-item">
            <div className="benefit-icon">
              {item.icon}
            </div>
            <span className="benefit-text">{item.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default BenefitsBar;