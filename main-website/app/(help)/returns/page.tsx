import React from 'react';
import '../../../styles/Legal.css'; // Adjust path based on where you put the CSS
import { getTranslator } from '../../../lib/i18n/server';

export const metadata = {
    title: 'Return & Refund Policy | nod',
};

export default async function ReturnsPage() {
    const { t } = await getTranslator();
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">{t('help.returns.title')}</h1>
                <p className="legal-date">{t('help.returns.intro')}</p>

                <div className="legal-section">
                    <h2>{t('help.returns.s1.title')}</h2>
                    <p>{t('help.returns.s1.p1')}</p>
                    <ul>
                        <li>{t('help.returns.s1.l1')}</li>
                        <li>{t('help.returns.s1.l2')}</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>{t('help.returns.s2.title')}</h2>
                    <p>{t('help.returns.s2.body')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('help.returns.s3.title')}</h2>
                    <ul>
                        <li>{t('help.returns.s3.l1')}</li>
                        <li>{t('help.returns.s3.l2')}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}