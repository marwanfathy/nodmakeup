import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../api/adminApi';
import { money, timeAgo } from '../utils/format';
import { SearchField, Chip, Loading, ErrorBox, Pagination, Select } from '../common/UI';

export const ORDER_CHIP = {
    Delivered: 'live', Shipped: 'live', Completed: 'live',
    Pending: 'pending', Processing: 'pending', Placed: 'pending', Confirmed: 'steel',
    Cancelled: 'danger', Returned: 'danger', Refunded: 'warn',
};

const OrderListPage = () => {
    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [statuses, setStatuses] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        orderApi.getStatuses().then(setStatuses).catch(() => {});
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        const timer = setTimeout(async () => {
            try {
                const res = await orderApi.getAll({ page, limit, search, status });
                if (active) setData(res);
            } catch (err) {
                if (active) setError(err?.response?.data?.message || err?.message || 'Failed to load orders.');
            } finally {
                if (active) setLoading(false);
            }
        }, 220);
        return () => { active = false; clearTimeout(timer); };
    }, [page, limit, search, status]);

    const onStatusSelect = (value) => {
        setStatus(value);
        setPage(1);
    };

    if (loading && !data) return <Loading label="Fetching orders…" />;
    if (error) return <ErrorBox message={error} onRetry={() => setPage(p => p)} />;

    const orders = data?.orders || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Commerce</div>
                    <h1 className="nd-page-title">Orders</h1>
                    <div className="nd-topbar-sub">{total} orders in ledger</div>
                </div>
            </div>

            <div className="nd-toolbar">
                <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Orders, customers, phones…" />
                <div className="nd-toolbar-right">
                    <Select value={status} onChange={(e) => onStatusSelect(e.target.value)} style={{ minWidth: 180 }}>
                        <option value="">All statuses</option>
                        {statuses.map(s => <option key={s.id} value={s.statusName}>{s.statusName}</option>)}
                    </Select>
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="nd-empty">
                    <h3>{search || status ? 'No orders in view' : 'No orders yet'}</h3>
                    <p>{search || status ? 'Adjust the search or filter.' : 'Orders will appear here as they come in.'}</p>
                </div>
            ) : (
                <div className="nd-table-wrap" style={{ marginBottom: 'var(--sp-5)' }}>
                    <table className="nd-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Order</th>
                                <th>Customer</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th>Status</th>
                                <th>Placed</th>
                                <th className="nd-actions">Reward</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o, i) => (
                                <tr key={o.order_id}>
                                    <td className="nd-index">0{(i + 1).toString().padStart(2, '0')}</td>
                                    <td><Link className="nd-link" to={`${o.order_id}`}>{o.order_number}</Link></td>
                                    <td>{o.customer_name}</td>
                                    <td className="nd-num nd-table-strong" style={{ textAlign: 'right' }}>{money(o.total_price)}</td>
                                    <td><Chip tone={ORDER_CHIP[o.status_name] || 'off'}>{o.status_name}</Chip></td>
                                    <td className="nd-faint">{timeAgo(o.created_at)}</td>
                                    <td className="nd-actions">
                                        {o.is_reward_sent
                                            ? <Chip tone="live">Sent</Chip>
                                            : <span className="nd-faint">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
                </div>
            )}
        </div>
    );
};

export default OrderListPage;