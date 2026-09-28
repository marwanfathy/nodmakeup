import React from 'react';
import '../../../styles/Legal.css'; // Adjust path based on where you put the CSS
import { getTranslator } from '../../../lib/i18n/server';

export const metadata = {
    title: 'Privacy Policy | nod',
};

export default async function PrivacyPage() {
    const { t } = await getTranslator();
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">{t('help.privacy.title')}</h1>
                <p className="legal-date">{t('help.lastUpdated')}</p>

                <div className="legal-section">
                    <h2>{t('help.privacy.s1.title')}</h2>
                    <p>{t('help.privacy.s1.intro')}</p>
                    <ul>
                        <li>{t('help.privacy.s1.l1')}</li>
                        <li>{t('help.privacy.s1.l2')}</li>
                        <li>{t('help.privacy.s1.l3')}</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>{t('help.privacy.s2.title')}</h2>
                    <ul>
                        <li>{t('help.privacy.s2.l1')}</li>
                        <li>{t('help.privacy.s2.l2')}</li>
                        <li>{t('help.privacy.s2.l3')}</li>
                        <li>{t('help.privacy.s2.l4')}</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>{t('help.privacy.s3.title')}</h2>
                    <p>{t('help.privacy.s3.body')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('help.privacy.s4.title')}</h2>
                    <p>{t('help.privacy.s4.body')}</p>
                </div>
                
                <div className="legal-contact">
                    {t('help.privacy.contact')}
                </div>
            </div>
        </div>
    );
}