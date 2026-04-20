import ProductCollectionSlider from "../LandingPageProductSlider/LandingPageProductSlider";
import '../globals.css';

const HomePage = () => {
  return (
    // Set the background color here to match the loader
    <div>
      
      <ProductCollectionSlider slug="nod" title="Our Bestsellers" />
      <ProductCollectionSlider slug="nod" title="Our Bestsellers" />
    </div>
  );
};

export default HomePage;