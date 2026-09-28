import React from 'react';
import '../../styles/Legal.css';
import { getTranslator } from '../../lib/i18n/server';

export const metadata = {
    title: 'The Story | nod',
};

export default async function AboutUsPage() {
    const { t } = await getTranslator();
    return (
        <div className="legal-page-wrapper">
            <div className="legal-container">
                <h1 className="legal-title">{t('about.title')}</h1>
                <p className="legal-date">{t('about.subtitle')}</p>

                <div className="legal-section">
                    <h2>{t('about.ourStory')}</h2>
                    <p>{t('about.ourStoryBody')}</p>
                </div>

                <div className="legal-section">
                    <h2>{t('about.standFor')}</h2>
                    <ul>
                        <li><strong>{t('about.clean')}</strong> {t('about.cleanBody')}</li>
                        <li><strong>{t('about.honest')}</strong> {t('about.honestBody')}</li>
                        <li><strong>{t('about.everyday')}</strong> {t('about.everydayBody')}</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>{t('about.site')}</h2>
                    <p>{t('about.siteBody')}</p>
                </div>
            </div>
        </div>
    );
}