import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/adminApi';
import { toast } from 'react-toastify';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const me = await authApi.me();
                if (active) setAdmin(me);
            } catch {
                try {
                    await authApi.refresh();
                    const me = await authApi.me();
                    if (active) setAdmin(me);
                } catch {
                    /* genuinely signed out */
                }
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const login = async (email, password) => {
        const me = await authApi.login(email, password);
        setAdmin(me);
        return me;
    };

    const logout = async () => {
        try { await authApi.logout(); } catch { /* ignore */ }
        setAdmin(null);
        toast.info('Signed out.');
    };

    return (
        <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => {
    const ctx = useContext(AdminAuthContext);
    if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
    return ctx;
};