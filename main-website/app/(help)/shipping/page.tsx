import React from 'react';
import '../../styles/Legal.css'; // Adjust path based on where you put the CSS
import { getTranslator } from '../../i18n/server';

export const metadata = {
    title: 'Shipping Policy | nod',
};

export default async function ShippingPage() {
    const { t } = await getTranslator();
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">{t('help.shipping.title')}</h1>
                <p className="legal-date">{t('help.lastUpdated')}</p>

                <div className="legal-section">
                    <h2>{t('help.shipping.s1.title')}</h2>
                    <p>{t('help.shipping.s1.body')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('help.shipping.s2.title')}</h2>
                    <ul>
                        <li>{t('help.shipping.s2.l1')}</li>
                        <li>{t('help.shipping.s2.l2')}</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>{t('help.shipping.s3.title')}</h2>
                    <p>{t('help.shipping.s3.body')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('help.shipping.s4.title')}</h2>
                    <p>{t('help.shipping.s4.body')}</p>
                </div>
            </div>
        </div>
    );
}