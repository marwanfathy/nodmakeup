import React from 'react';
import '../../styles/Legal.css'; // Adjust path based on where you put the CSS
import { getTranslator } from '../../i18n/server';

export const metadata = {
    title: 'Terms of Service | nod',
    description: 'Terms and conditions for using nod website and products.',
};

export default async function TermsPage() {
    const { t } = await getTranslator();
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">{t('help.terms.title')}</h1>
                <p className="legal-date">{t('help.lastUpdated')}</p>

                <div className="legal-section">
                    <h2>{t('help.terms.s1.title')}</h2>
                    <p>{t('help.terms.s1.body')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('help.terms.s2.title')}</h2>
                    <p>{t('help.terms.s2.body')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('help.terms.s3.title')}</h2>
                    <p>{t('help.terms.s3.p1')}</p>
                    <ul>
                        <li><strong>{t('help.terms.s3.l1')}</strong></li>
                        <li><strong>{t('help.terms.s3.l2')}</strong></li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>{t('help.terms.s4.title')}</h2>
                    <p>{t('help.terms.s4.body')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('help.terms.s5.title')}</h2>
                    <ul>
                        <li>{t('help.terms.s5.l1')}</li>
                        <li>{t('help.terms.s5.l2')}</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>{t('help.terms.s6.title')}</h2>
                    <p>{t('help.terms.s6.body')}</p>
                </div>
            </div>
        </div>
    );
}