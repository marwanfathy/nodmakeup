"use client"; // <--- Add this line

import React, { useState, useEffect } from 'react';
import { getHeroProducts, ProductSummary } from '@/lib/api';
import HeroProductCard from './HeroProductCard';
import './HeroProductCard.css';

const HeroProductSection: React.FC = () => {
  const [heroProducts, setHeroProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHeroProducts = async () => {
      try {
        setLoading(true);
        const data = await getHeroProducts(); 
        setHeroProducts(data || []);
      } catch (err) {
        console.error("Failed to fetch hero products:", err);
        setError("Could not load featured products at this time.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchHeroProducts();
  }, []);

  if (loading) {
    return (
      <div className="hero-section-container">
        <div className="hero-card-container loading">
          <p>Loading featured products...</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="hero-section-container error-message">{error}</div>;
  if (heroProducts.length === 0) return null;

  const primaryHeroProduct = heroProducts[0];

  return (
    <div className="hero-section-container">
      <HeroProductCard product={primaryHeroProduct} />
    </div>
  );
};

export default HeroProductSection;