import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { initials } from '../utils/format';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import PanoramaRoundedIcon from '@mui/icons-material/PanoramaRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

const GROUPS = [
    {
        items: [
            { to: '/admin', label: 'Overview', icon: <DashboardRoundedIcon />, end: true },
        ],
    },
    {
        items: [
            { to: '/admin/products', label: 'Products', icon: <Inventory2RoundedIcon /> },
            { to: '/admin/categories', label: 'Categories', icon: <AccountTreeRoundedIcon /> },
            { to: '/admin/brands', label: 'Brands', icon: <DiamondRoundedIcon /> },
            { to: '/admin/collections', label: 'Collections', icon: <CollectionsRoundedIcon /> },
        ],
    },
    {
        items: [
            { to: '/admin/orders', label: 'Orders', icon: <ReceiptLongRoundedIcon /> },
            { to: '/admin/discounts', label: 'Discounts', icon: <LocalOfferRoundedIcon /> },
        ],
    },
    {
        items: [
            { to: '/admin/stories', label: 'Stories', icon: <PlayCircleOutlineRoundedIcon /> },
            { to: '/admin/hero-sections', label: 'Hero Sections', icon: <PanoramaRoundedIcon /> },
        ],
    },
    {
        items: [
            { to: '/admin/customers', label: 'Customers', icon: <GroupsRoundedIcon /> },
            { to: '/admin/analytics', label: 'Analytics', icon: <InsightsRoundedIcon /> },
        ],
    },
    {
        items: [
            { to: '/admin/admins', label: 'Admins', icon: <AdminPanelSettingsRoundedIcon /> },
        ],
    },
];

const Sidebar = () => {
    const { admin, logout } = useAdminAuth();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);

    const onLogout = async () => {
        setBusy(true);
        await logout();
        navigate('/login');
        setBusy(false);
    };

    return (
        <aside className="nd-dock" aria-label="Sections">
            <NavLink to="/admin" end className="nd-dock-brand" data-label="Overview" title="Overview">
                <span className="nd-brand-mark" />
            </NavLink>

            {GROUPS.map((group, gi) => (
                <div className="nd-dock-group" key={gi}>
                    {group.items.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            title={item.label}
                            data-label={item.label}
                            className={({ isActive }) => `nd-dock-btn ${isActive ? 'active' : ''}`}
                            style={{ fontSize: 20 }}
                        >
                            {item.icon}
                        </NavLink>
                    ))}
                </div>
            ))}

            <div className="nd-dock-group nd-dock-avatar" title={admin ? `${admin.firstName} ${admin.lastName}` : 'Sign in'}>
                <span className="nd-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                    {initials(admin?.firstName, admin?.lastName)}
                </span>
            </div>
            <button className="nd-dock-btn danger" style={{ fontSize: 20 }} data-label="Sign out" title="Sign out" disabled={busy} onClick={onLogout}>
                <LogoutRoundedIcon />
            </button>
        </aside>
    );
};

export default Sidebar;