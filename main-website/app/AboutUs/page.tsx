import React from 'react';
import '../styles/Legal.css';

export const metadata = {
    title: 'The Story | nod',
};

export default function AboutUsPage() {
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">The Story</h1>
                <p className="legal-date">Beauty made simple, honest, and beautifully you.</p>

                <div className="legal-section">
                    <h2>Our Story</h2>
                    <p>nod was born from a simple belief: makeup should highlight who you already are, not hide it. We craft clean, high-performance formulas that feel weightless on the skin and effortless in your routine.</p>
                </div>

                <div className="legal-section">
                    <h2>What We Stand For</h2>
                    <ul>
                        <li><strong>Clean Ingredients:</strong> Skin-loving formulas without unnecessary fillers.</li>
                        <li><strong>Honest Prices:</strong> Luxury-level quality at prices that make sense.</li>
                        <li><strong>Everyday Beauty:</strong> Products designed for real life, not just the shelf.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>About This Site</h2>
                    <p>This storefront is powered by a full microservices platform spanning the product catalog, media delivery, analytics, and order management. Every image, collection, and story you see here is served live from the backend.</p>
                </div>
            </div>
        </div>
    );
}