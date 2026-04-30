"use client"; // Required for useState in Next.js App Router

import React, { useState } from 'react';
import Lan_Banner from "./Lan_banner/Lan_banner";
import ProductCollectionSlider from "./LandingPageProductSlider/LandingPageProductSlider";
import './globals.css';
import HeroSlider from './HeroProductCard/HeroSlider';
import BenefitsBar from './BenefitsBar/BenefitsBar';
import HeroProductSection from './HeroProductCard2/HeroSection';
import Stories from "./Stories/Stories";
import WelcomeUser from './welcome.js';

const HomePage = () => {
  // 1. Create a state to track if the welcome animation is finished
  const [isReady, setIsReady] = useState(false);

  return (
    <div style={{ backgroundColor: '#fff' }}> {/* Set background to match your loader */}
      
      {/* 2. Show WelcomeUser only if isReady is false */}
      {!isReady ? (
        <WelcomeUser onAnimationEnd={() => setIsReady(true)} />
      ) : (
        /* 3. Show the actual website content once isReady is true */
        <div className="fade-in-content">
          <WelcomeUser onAnimationEnd={() => setIsReady(true)} /> {/* Optional: Keep it if you want it to fade out smoothly */}
          <Stories />
          <Lan_Banner />
          <HeroProductSection />
          <ProductCollectionSlider slug="la-vie-en-rose" title="Our Bestsellers" />
          <HeroSlider slug="tttt" /> 
          <BenefitsBar />
        </div>
      )}
      
    </div>
  );
};

export default HomePage;