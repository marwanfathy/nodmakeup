import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/adminApi';
import useFetchData from '../hooks/useFetchData';
import { money, timeAgo } from '../utils/format';
import { Kpi, Loading, ErrorBox, Chip } from '../common/UI';

const STAT_TONE = {
    Delivered: 'live',
    Shipped: 'live',
    Completed: 'live',
    Pending: 'pending',
    Processing: 'pending',
    Cancelled: 'danger',
    Returned: 'danger',
    Refunded: 'warn',
};

const DashboardPage = () => {
    const [refetchIndex, setRefetchIndex] = useState(0);
    const { data: stats, loading, error } = useFetchData(dashboardApi.getStats, refetchIndex);

    if (loading) return <Loading label="Calculating the house numbers…" />;
    if (error) return <ErrorBox message={error} onRetry={() => setRefetchIndex(i => i + 1)} />;

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Overview</div>
                    <h1 className="nd-page-title">At a Glance</h1>
                    <div className="nd-topbar-sub">The portrait of the house today.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="nd-live">{stats.liveVisitors} on the site now</span>
                </div>
            </div>

            <div className="nd-grid nd-grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
                <Kpi label="Total sales" value={money(stats.totalSales)} />
                <Kpi label="Orders" value={stats.totalOrders.toLocaleString()} />
                <Kpi label="Average order" value={money(stats.averageOrderValue)} />
                <Kpi label="New today" value={stats.newOrdersToday.toLocaleString()} />
            </div>

            <div className="nd-grid nd-grid-3" style={{ marginBottom: 'var(--sp-6)' }}>
                <Kpi label="Pending orders" value={stats.pendingOrders.toLocaleString()} />
                <Kpi label="Low-stock signals" value={stats.lowStockAlerts.toLocaleString()} />
                <Kpi label="Shipping revenue" value={money(stats.totalShippingRevenue)} />
            </div>

            <div className="nd-table-wrap">
                <div className="nd-panel-head" style={{ padding: 'var(--sp-5) var(--sp-5) 0', marginBottom: 0 }}>
                    <div>
                        <h2 className="nd-panel-title">Recent orders</h2>
                        <p className="nd-panel-sub">The latest through the door.</p>
                    </div>
                    <Link className="nd-btn nd-btn-secondary nd-btn-sm" to="/admin/orders">View all</Link>
                </div>
                <table className="nd-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Order</th>
                            <th>Customer</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Placed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.recentOrders.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>No orders yet.</td></tr>
                        )}
                        {stats.recentOrders.map((o, i) => (
                            <tr key={o.id} className="nd-row-link">
                                <td className="nd-index">0{i + 1}</td>
                                <td><Link className="nd-link" to={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></td>
                                <td>{o.customerName}</td>
                                <td className="nd-num nd-table-strong">{money(o.totalPrice)}</td>
                                <td><Chip tone={STAT_TONE[o.status] || 'off'}>{o.status}</Chip></td>
                                <td className="nd-faint">{timeAgo(o.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DashboardPage;