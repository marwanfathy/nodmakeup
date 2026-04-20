import React from 'react';
import '../../styles/Legal.css'; // Adjust path based on where you put the CSS

export const metadata = {
    title: 'Shipping Policy | nod',
};

export default function ShippingPage() {
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">Shipping Policy</h1>
                <p className="legal-date">Last Updated: November 27, 2025</p>

                <div className="legal-section">
                    <h2>1. Processing Time</h2>
                    <p>All nod orders are processed within <strong>1-2 business days</strong>. Orders placed on weekends or holidays will be processed the following business day.</p>
                </div>

                <div className="legal-section">
                    <h2>2. Shipping Rates & Estimates</h2>
                    <ul>
                        <li><strong>Standard Shipping:</strong> 3-5 business days.</li>
                        <li><strong>Express Shipping:</strong> 1-2 business days.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>3. International Shipping</h2>
                    <p>We ship worldwide. Please note that International orders may be subject to import taxes, customs duties, and fees levied by the destination country. These charges are the responsibility of the recipient.</p>
                </div>

                <div className="legal-section">
                    <h2>4. Lost or Stolen Packages</h2>
                    <p>nod is not responsible for packages confirmed as delivered to the address entered at checkout. If your tracking says "Delivered" but you have not received it, please contact the shipping carrier directly.</p>
                </div>
            </div>
        </div>
    );
}