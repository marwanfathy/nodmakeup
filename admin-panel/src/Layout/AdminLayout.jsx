import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

export const AdminProtectedRoute = () => {
    const { admin, loading } = useAdminAuth();
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
                <span className="nd-spinner md" />
            </div>
        );
    }
    if (!admin) return <Navigate to="/login" replace />;
    return <Outlet />;
};

const AdminLayout = () => (
    <div className="nd-app">
        <Sidebar />
        <div className="nd-main">
            <Header />
            <main className="nd-content">
                <Outlet />
            </main>
        </div>
    </div>
);

export default AdminLayout;