"use client";

import "./Lan_banner.css";

const apiBaseUrl = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:5002";
// Replace with your actual image path
const BannerImg = '/uploads/images/WhatsApp Image 2026-04-08 at 4.52.06 AM(1).jpeg'

const Lan_Banner = () => {
  return (
    <div className="lan-banner-wrapper"> {/* New wrapper for outer spacing */}
      <div className="lan-banner-container">
        <img className="lan-banner-img" src={`${apiBaseUrl}${BannerImg}`} alt="node Banner" />
        
        <div className="lan-banner-overlay">
          <p className="lan-tagline">The lineup is here</p>
          <h1 className="lan-title">NOD x the night</h1>
          <button className="lan-pill-button">Shop the collection</button>
        </div>
      </div>
    </div>
  );
};

export default Lan_Banner;