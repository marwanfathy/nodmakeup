import React from 'react';
import '../../styles/Legal.css'; // Adjust path based on where you put the CSS

export const metadata = {
    title: 'Return Policy | nod',
};

export default function ReturnsPage() {
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">Return & Refund Policy</h1>
                <p className="legal-date">Last Updated: November 27, 2025</p>

                <div className="legal-section">
                    <p>At nod, we pride ourselves on the exceptional quality of our luxury formulations. We want you to love your purchase, but we also prioritize the health and safety of our community.</p>
                </div>

                <div className="legal-section">
                    <h2>1. Return Policy</h2>
                    <p>Due to the hygienic nature of cosmetic products, <strong>we cannot accept returns on opened or used items.</strong></p>
                    <ul>
                        <li><strong>Eligibility:</strong> Returns are accepted within 14 days of the delivery date.</li>
                        <li><strong>Condition:</strong> To be eligible for a return, the item must be unopened, in its original packaging, with the safety seal intact.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>2. Damaged or Defective Items</h2>
                    <p>If you receive a damaged, defective, or incorrect item, please contact us immediately. We will arrange a replacement or a full refund at no cost to you.</p>
                </div>

                <div className="legal-section">
                    <h2>3. Non-Returnable Items</h2>
                    <ul>
                        <li>Sale items or Gift Cards.</li>
                        <li>Products that have been opened, swatched, or tested.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>4. How to Initiate a Return</h2>
                    <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                        <li>Email <strong>support@nod.com</strong> with your Order Number.</li>
                        <li>If approved, we will provide you with a return shipping address.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}