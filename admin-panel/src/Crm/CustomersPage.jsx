import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { crmApi } from '../api/adminApi';
import { money, timeAgo, errMsg } from '../utils/format';
import { Kpi, Loading, ErrorBox, SearchField, Select, Pagination, Chip, EmptyState } from '../common/UI';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';

const SEGMENT_TONE = { NEW: 'steel', RETURNING: 'live', LOYAL: 'live', AT_RISK: 'warn', CHURNED: 'off', VIP: 'steel' };

const CustomersPage = () => {
    const [search, setSearch] = useState('');
    const [segment, setSegment] = useState('');
    const [page, setPage] = useState(1);
    const [overview, setOverview] = useState(null);
    const [segments, setSegments] = useState([]);
    const [rows, setRows] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async (force = false) => {
        if (!rows || force) {
            setLoading(true);
            try {
                const [ov, seg] = await Promise.all([crmApi.getOverview(), crmApi.getSegments()]);
                setOverview(ov);
                setSegments(seg);
            } catch (e) {
                setError(errMsg(e, 'Failed to load CRM overview.'));
            }
        }
        try {
            const res = await crmApi.getCustomers({ search, segment, page, limit: 15 });
            setRows(res);
        } catch (e) {
            setError(errMsg(e, 'Failed to load customers.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => { load(true); }, segment || search ? 250 : 0);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, segment, page]);

    const backfill = async () => {
        try {
            await crmApi.backfill();
            toast.success('Profiles rebuilt from the ledger.');
            load(true);
        } catch (e) {
            toast.error(errMsg(e, 'Backfill failed.'));
        }
    };

    if (loading && !rows && !overview) return <Loading label="Opening the client book…" />;
    if (error) return <ErrorBox message={error} onRetry={() => load(true)} />;

    const customers = rows?.customers || [];
    const segmentsAll = segments || [];

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Community</div>
                    <h1 className="nd-page-title">Customers</h1>
                    <div className="nd-topbar-sub">The client book.</div>
                </div>
                <button className="nd-btn nd-btn-secondary" onClick={backfill}>
                    <ReplayRoundedIcon style={{ fontSize: 16 }} /> Rebuild profiles
                </button>
            </div>

            {overview && (
                <div className="nd-grid nd-grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
                    <Kpi label="Customers" value={overview.totalCustomers.toLocaleString()} />
                    <Kpi label="Orders" value={overview.totalOrders.toLocaleString()} />
                    <Kpi label="Lifetime value" value={money(overview.averageLifetimeValue)} delta="avg per customer" />
                    <Kpi label="Order value" value={money(overview.orderValue)} delta="total sales" />
                </div>
            )}

            {segmentsAll.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--sp-6)' }}>
                    {segmentsAll.map(s => (
                        <button key={s.segment} onClick={() => setSegment(segment === s.segment ? '' : s.segment)}
                            style={{ border: 'none', cursor: 'pointer', fontSize: 'var(--step-sm)' }}
                            className={`nd-chip ${segment === s.segment ? 'is-live' : 'is-off'}`}>
                            {s.label} · {s.count} {s.count === 1 ? 'client' : 'clients'}
                        </button>
                    ))}
                </div>
            )}

            <div className="nd-toolbar">
                <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, phone, email…" />
                <Select value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1); }} style={{ minWidth: 170 }}>
                    <option value="">All segments</option>
                    {segmentsAll.map(s => <option key={s.segment} value={s.segment}>{s.label}</option>)}
                </Select>
            </div>

            {customers.length === 0 ? (
                <EmptyState title={search || segment ? 'No clients in view' : 'The book is empty'} sub={search || segment ? 'Adjust the filters.' : 'Profiles appear after the first orders.'} />
            ) : (
                <div className="nd-table-wrap" style={{ marginBottom: 'var(--sp-5)' }}>
                    <table className="nd-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Client</th>
                                <th>Phone</th>
                                <th>Governorate</th>
                                <th>Segment</th>
                                <th style={{ textAlign: 'right' }}>Orders</th>
                                <th style={{ textAlign: 'right' }}>Spent</th>
                                <th>Last order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c, i) => (
                                <tr key={c.id}>
                                    <td className="nd-index">0{(i + 1).toString().padStart(2, '0')}</td>
                                    <td><Link className="nd-link" to={`${c.id}`}>{c.name}</Link></td>
                                    <td className="nd-mono">{c.phone}</td>
                                    <td className="nd-faint">{c.governorate || '—'}</td>
                                    <td><Chip tone={SEGMENT_TONE[c.segment] || 'off'}>{c.segment}</Chip></td>
                                    <td className="nd-num" style={{ textAlign: 'right' }}>{c.totalOrders}</td>
                                    <td className="nd-num nd-table-strong" style={{ textAlign: 'right' }}>{money(c.totalSpent)}</td>
                                    <td className="nd-faint">{timeAgo(c.lastOrderAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pagination page={page} totalPages={rows?.meta?.totalPages || 1} total={rows?.meta?.total || 0} onPage={setPage} />
                </div>
            )}
        </div>
    );
};

export default CustomersPage;