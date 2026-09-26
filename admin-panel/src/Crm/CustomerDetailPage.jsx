import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { crmApi } from '../api/adminApi';
import { money, shortDate, timeAgo, errMsg } from '../utils/format';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Loading, ErrorBox, Kpi, Panel, Chip, Field, Input, Textarea } from '../common/UI';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';

const SEGMENT_TONE = { NEW: 'steel', RETURNING: 'live', LOYAL: 'live', AT_RISK: 'warn', CHURNED: 'off', VIP: 'steel' };

const CustomerDetailPage = () => {
    const { customerId } = useParams();
    const navigate = useNavigate();
    const { admin } = useAdminAuth();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [note, setNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState({});

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await crmApi.getCustomer(customerId));
        } catch (e) {
            setError(errMsg(e, 'Failed to load the client.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId]);

    const addNote = async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        setSavingNote(true);
        try {
            await crmApi.addNote(customerId, { note: note.trim() });
            setNote('');
            load();
        } catch (e) {
            toast.error(errMsg(e, 'Could not save the note.'));
        } finally {
            setSavingNote(false);
        }
    };

    const openEdit = () => {
        const c = data.customer;
        setDraft({ name: c.name, email: c.email || '', governorate: c.governorate || '', address: c.address || '', segment: c.segment, tags: (c.tags || []).join(', ') });
        setEditOpen(true);
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        try {
            await crmApi.updateCustomer(customerId, {
                name: draft.name.trim(),
                email: draft.email.trim() || null,
                governorate: draft.governorate.trim() || null,
                address: draft.address.trim() || null,
                segment: draft.segment,
                tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 20),
            });
            toast.success('Client updated.');
            setEditOpen(false);
            load();
        } catch (err) {
            toast.error(errMsg(err, 'Save failed.'));
        }
    };

    if (loading) return <Loading label="Closing in on the client…" />;
    if (error) return <ErrorBox message={error} onRetry={load} />;

    const { customer: c, orders, notes } = data;

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <button className="nd-btn-back" onClick={() => navigate('/admin/customers')}>
                        <ArrowBackRoundedIcon style={{ fontSize: 16 }} /> Customers
                    </button>
                    <h1 className="nd-page-title">{c.name}</h1>
                    <div className="nd-topbar-sub">{c.phone}</div>
                </div>
                <button className="nd-btn nd-btn-secondary" onClick={openEdit}>Edit profile</button>
            </div>

            <div className="nd-grid nd-grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
                <Kpi label="Segment" value={<Chip tone={SEGMENT_TONE[c.segment] || 'off'}>{c.segment}</Chip>} />
                <Kpi label="Orders" value={c.totalOrders} />
                <Kpi label="Spent" value={money(c.totalSpent)} />
                <Kpi label="Last order" value={timeAgo(c.lastOrderAt)} />
            </div>

            {c.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--sp-6)' }}>
                    {c.tags.map((t, i) => <span key={i} className="nd-chip is-off">{t}</span>)}
                </div>
            )}

            <div className="nd-grid" style={{ gridTemplateColumns: '1.1fr 1fr', marginBottom: 'var(--sp-6)', gap: 'var(--sp-6)' }}>
                <Panel title="Orders" sub="The ledger, newest first.">
                    {orders.length === 0 ? (
                        <span className="nd-hint">No orders on file.</span>
                    ) : (
                        <div className="nd-table-wrap" style={{ border: 'none' }}>
                            <table className="nd-table">
                                <thead><tr><th>Order</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Reward</th></tr></thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o.id}>
                                            <td><Link className="nd-link nd-mono" to={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></td>
                                            <td className="nd-faint">{shortDate(o.createdAt)}</td>
                                            <td><Chip tone="off">{o.statusName}</Chip></td>
                                            <td className="nd-num nd-table-strong" style={{ textAlign: 'right' }}>{money(o.totalPrice)}</td>
                                            <td style={{ textAlign: 'right' }}>{o.isRewardSent ? <span className="nd-chip is-live">Sent</span> : <span className="nd-hint">—</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>

                <Panel title="Profile" sub="Contact and location.">
                    <div className="nd-stack nd-stack-sm">
                        <div className="nd-detail-row"><span>Email</span><span>{c.email || '—'}</span></div>
                        <div className="nd-detail-row"><span>Address</span><span>{c.address ? `${c.address}${c.governorate ? `, ${c.governorate}` : ''}` : c.governorate || '—'}</span></div>
                        <div className="nd-detail-row"><span>Since</span><span>{shortDate(c.createdAt)}</span></div>
                    </div>
                </Panel>
            </div>

            <Panel title="Notes" sub="Private remarks for the studio.">
                <form className="nd-note-form" onSubmit={addNote}>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a note about this client…" />
                    <button className="nd-btn nd-btn-primary" disabled={savingNote || !note.trim()}>
                        <SendRoundedIcon style={{ fontSize: 15 }} /> {savingNote ? 'Saving…' : 'Add note'}
                    </button>
                </form>
                <div className="nd-stack">
                    {notes.map(n => (
                        <article key={n.id} className="nd-note">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                <span className="nd-faint" style={{ fontSize: 'var(--step-caption)' }}>{n.author}{n.author === admin?.firstName ? ' (you)' : ''}</span>
                                <span className="nd-faint" style={{ fontSize: 'var(--step-caption)' }}>{timeAgo(n.createdAt)}</span>
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: 'var(--step-sm)' }}>{n.note}</p>
                        </article>
                    ))}
                    {notes.length === 0 && <span className="nd-hint">Nothing on the notepad yet.</span>}
                </div>
            </Panel>

            {editOpen && (
                <div className="nd-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditOpen(false)}>
                    <div className="nd-modal" style={{ maxWidth: 480 }}>
                        <div className="nd-modal-head"><h3 className="nd-label">Edit profile</h3><button className="nd-btn-icon" onClick={() => setEditOpen(false)}>✕</button></div>
                        <form onSubmit={saveEdit} noValidate>
                            <Field label="Name" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                            <Field label="Email"><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
                            <div className="nd-field-row">
                                <Field label="Governorate"><Input value={draft.governorate} onChange={(e) => setDraft({ ...draft, governorate: e.target.value })} /></Field>
                                <Field label="Segment">
                                    <select className="nd-select" value={draft.segment} onChange={(e) => setDraft({ ...draft, segment: e.target.value })}>
                                        {['NEW', 'RETURNING', 'LOYAL', 'AT_RISK', 'CHURNED', 'VIP'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </Field>
                            </div>
                            <Field label="Address"><Textarea value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
                            <Field label="Tags" hint="Comma separated."><Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="vip, bridal, restock" /></Field>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button type="button" className="nd-btn nd-btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                                <button type="submit" className="nd-btn nd-btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDetailPage;