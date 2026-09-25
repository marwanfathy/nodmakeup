import React from 'react';
import '../../styles/Legal.css'; // Adjust path based on where you put the CSS

export const metadata = {
    title: 'Privacy Policy | nod',
};

export default function PrivacyPage() {
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">Privacy Policy</h1>
                <p className="legal-date">Last Updated: November 27, 2025</p>

                <div className="legal-section">
                    <h2>1. What We Collect</h2>
                    <p>When you visit nod, we collect:</p>
                    <ul>
                        <li><strong>Personal Information:</strong> Name, email address, shipping address, and phone number.</li>
                        <li><strong>Payment Information:</strong> Processed securely by third-party processors. nod does not store your full credit card info.</li>
                        <li><strong>Browsing Data:</strong> IP address, cookies, and device info.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>2. How We Use Your Information</h2>
                    <ul>
                        <li>To process and fulfill your orders.</li>
                        <li>To communicate with you regarding your order status.</li>
                        <li>To send you luxury newsletters and exclusive offers (only if you opted in).</li>
                        <li>To prevent fraud and improve our website security.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>3. Third-Party Sharing</h2>
                    <p>We do not sell your personal data. We share data only with trusted third parties necessary to operate our business (e.g., Shipping providers, Payment processors).</p>
                </div>

                <div className="legal-section">
                    <h2>4. Cookies</h2>
                    <p>We use cookies to remember your cart items and analyze site traffic. You can choose to disable cookies through your browser settings.</p>
                </div>
                
                <div className="legal-contact">
                    Questions? Contact us at privacy@nod.com
                </div>
            </div>
        </div>
    );
}