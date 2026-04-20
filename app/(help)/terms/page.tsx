import React from 'react';
import '../../styles/Legal.css'; // Adjust path based on where you put the CSS

export const metadata = {
    title: 'Terms of Service | nod',
    description: 'Terms and conditions for using nod website and products.',
};

export default function TermsPage() {
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">Terms of Service</h1>
                <p className="legal-date">Last Updated: November 27, 2025</p>

                <div className="legal-section">
                    <h2>1. Introduction</h2>
                    <p>Welcome to nod. These Terms of Service govern your use of our website and the purchase of our luxury cosmetic products. By accessing our site or purchasing from us, you agree to be bound by these Terms.</p>
                </div>

                <div className="legal-section">
                    <h2>2. Accuracy of Information & Colors</h2>
                    <p>We strive to present our products as accurately as possible. However, the colors of makeup products (lipsticks, foundations, eyeshadows) as seen on your monitor or screen may differ from the actual product due to display settings and lighting. nod does not guarantee that your monitor's display of any color will be accurate.</p>
                </div>

                <div className="legal-section">
                    <h2>3. Medical Disclaimer</h2>
                    <p>nod products are cosmetic in nature and are not intended to diagnose, treat, cure, or prevent any medical condition.</p>
                    <ul>
                        <li><strong>Allergies:</strong> Please review the ingredient list on the product packaging or website before use. nod is not liable for any allergic reactions.</li>
                        <li><strong>Patch Test:</strong> We strongly recommend performing a patch test before using any new product.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>4. Intellectual Property</h2>
                    <p>All content on this site—including the nod logo, brand identity, text, graphics, images, and software—is the property of nod and is protected by copyright and trademark laws.</p>
                </div>

                <div className="legal-section">
                    <h2>5. Purchases & Pricing</h2>
                    <ul>
                        <li><strong>Resale Prohibited:</strong> Products are sold for personal use only. We reserve the right to limit quantities or cancel orders that appear to be for resale.</li>
                        <li><strong>Pricing:</strong> Prices are subject to change without notice.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>6. Limitation of Liability</h2>
                    <p>To the fullest extent permitted by law, nod shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or website.</p>
                </div>
            </div>
        </div>
    );
}