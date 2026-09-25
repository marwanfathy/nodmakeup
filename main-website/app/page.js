import Lan_Banner from "./Lan_banner/Lan_banner";
import './globals.css';
import BenefitsBar from './BenefitsBar/BenefitsBar';
import HeroProductSection from './HeroProductCard2/HeroSection'
import Stories from "./Stories/Stories";
import CollectionsSection from "./CollectionsSection/CollectionsSection";

const HomePage = () => {
  return (
    <div>
      <Stories />
      <Lan_Banner />
      <HeroProductSection />
      <CollectionsSection variant="featured" />
      <BenefitsBar />
    </div>
  );
};

export default HomePage;