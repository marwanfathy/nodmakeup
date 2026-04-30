import Lan_Banner from "./Lan_banner/Lan_banner";
import ProductCollectionSlider from "./LandingPageProductSlider/LandingPageProductSlider";
import './globals.css';
import HeroSlider from './HeroProductCard/HeroSlider';
import BenefitsBar from './BenefitsBar/BenefitsBar';
import HeroProductSection from './HeroProductCard2/HeroSection'
import Stories from "./Stories/Stories";
import WelcomeUser from './Welcome';

const HomePage = () => {
  return (
    // Set the background color here to match the loader
    <div>
      <WelcomeUser />
      <Stories />
      <Lan_Banner />
      <HeroProductSection />
      <ProductCollectionSlider slug="la-vie-en-rose" title="Our Bestsellers" />
      {/* <HeroSlider slug="tttt" /> */}
      <BenefitsBar />
    </div>
  );
};

export default HomePage;