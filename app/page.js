import Lan_Banner from "./Lan_banner/Lan_banner";
import ProductCollectionSlider from "./LandingPageProductSlider/LandingPageProductSlider";
import './globals.css';
import HeroSlider from './HeroProductCard/HeroSlider';
import BenefitsBar from './BenefitsBar/BenefitsBar';
import HeroProductSection from './HeroProductCard2/HeroSection'
import Stories from "./Stories/Stories";
import WelcomeUser from './welcome.js';

const HomePage = () => {
  return (
    <main>
      {/* This will stay on screen permanently */}
      <WelcomeUser />

      {/* 
        The rest of the site is hidden/commented out. 
        When you are ready to go live, you can uncomment these.
      */}
      {/*
      <Stories />
      <Lan_Banner />
      <HeroProductSection />
      <ProductCollectionSlider slug="la-vie-en-rose" title="Our Bestsellers" />
      <HeroSlider slug="tttt" /> 
      <BenefitsBar />
      */}
    </main>
  );
};

export default HomePage;