import '../globals.css';
import CollectionsSection from "../CollectionsSection/CollectionsSection";

export const metadata = {
    title: 'Bestsellers | NOD Makeup',
    description: 'Shop NOD Makeup bestsellers — the products our customers love most, all in one place.',
};

const BestsellersPage = () => {
  return (
    <div>
      <CollectionsSection variant="all" />
    </div>
  );
};

export default BestsellersPage;