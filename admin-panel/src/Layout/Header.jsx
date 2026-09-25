import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { initials } from '../utils/format';

const SECTION_MAP = [
    { re: /^\/admin\/products/, eyebrow: 'Catalog', label: 'Products' },
    { re: /^\/admin\/categories/, eyebrow: 'Catalog', label: 'Categories' },
    { re: /^\/admin\/brands/, eyebrow: 'Catalog', label: 'Brands' },
    { re: /^\/admin\/collections/, eyebrow: 'Catalog', label: 'Collections' },
    { re: /^\/admin\/orders/, eyebrow: 'Commerce', label: 'Orders' },
    { re: /^\/admin\/discounts/, eyebrow: 'Commerce', label: 'Discounts' },
    { re: /^\/admin\/stories/, eyebrow: 'Content', label: 'Stories' },
    { re: /^\/admin\/hero-sections/, eyebrow: 'Content', label: 'Hero Sections' },
    { re: /^\/admin\/customers/, eyebrow: 'Community', label: 'Customers' },
    { re: /^\/admin\/analytics/, eyebrow: 'Intelligence', label: 'Analytics' },
    { re: /^\/admin\/admins/, eyebrow: 'System', label: 'Admins' },
    { re: /^\/admin\/?$/, eyebrow: 'Overview', label: 'At a Glance' },
];

const Header = () => {
    const { pathname } = useLocation();
    const { admin } = useAdminAuth();
    const section = SECTION_MAP.find(s => s.re.test(pathname)) || SECTION_MAP[SECTION_MAP.length - 1];

    return (
        <header className="nd-topbar">
            <div className="nd-topbar-inner">

                <div className="nd-topbar-section">
                    <span className="nd-eyebrow">{section.eyebrow}</span>
                    <span className="nd-topbar-title">{section.label}</span>
                </div>

                <div className="nd-topbar-actions">
                    <div className="nd-user">
                        <div className="nd-user-meta">
                            <div className="nd-user-name">{admin?.firstName} {admin?.lastName}</div>
                            <div className="nd-user-role">{admin?.email}</div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;