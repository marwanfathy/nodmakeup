import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { orderApi } from '../api/adminApi';
import { errMsg, money, shortDateTime } from '../utils/format';
import { Loading, ErrorBox, Panel, Chip, Select, Input, Field, Modal } from '../common/UI';
import { ORDER_CHIP } from './OrderListPage';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';

const TransactionStatusOptions = ['Completed', 'Pending', 'Failed', 'Refunded'];

const OrderDetailPage = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newStatusId, setNewStatusId] = useState('');
    const [txStatusFor, setTxStatusFor] = useState(null);
    const [rewardOpen, setRewardOpen] = useState(false);
    const [reward, setReward] = useState({ discountType: 'PERCENTAGE', discountValue: '10' });
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const o = await orderApi.getById(orderId);
            setOrder(o);
            setNewStatusId(o.statusId || '');
        } catch (err) {
            setError(errMsg(err, 'Failed to load order.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        orderApi.getStatuses().then(setStatuses).catch(() => {});
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    const updateStatus = async () => {
        if (!newStatusId) return;
        setBusy(true);
        try {
            const res = await orderApi.updateStatus(order.id, newStatusId);
            setOrder(res.order);
            setNewStatusId(res.order.statusId);
            toast.success('Order status updated.');
        } catch (err) {
            toast.error(errMsg(err, 'Status update failed.'));
        } finally {
            setBusy(false);
        }
    };

    const updateTx = async () => {
        if (!txStatusFor) return;
        setBusy(true);
        try {
            const res = await orderApi.updateTransactionStatus(order.id, txStatusFor.newStatus);
            setOrder(res.order);
            toast.success('Transaction status updated.');
        } catch (err) {
            toast.error(errMsg(err, 'Transaction update failed.'));
        } finally {
            setBusy(false);
            setTxStatusFor(null);
        }
    };

    const sendReward = async () => {
        setBusy(true);
        try {
            const res = await orderApi.sendReward(order.id, {
                discountType: reward.discountType,
                discountValue: reward.discountValue,
            });
            toast.success(res.message || 'Reward sent.');
            setRewardOpen(false);
            load();
        } catch (err) {
            toast.error(errMsg(err, 'Reward failed to send.'));
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <Loading label="Opening the order…" />;
    if (error) return <ErrorBox message={error} onRetry={load} />;

    const items = order.items || [];
    const transactions = order.transactions || [];
    const discounts = order.appliedDiscounts || [];

    return (
        <div style={{ maxWidth: 960 }}>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Commerce · Orders</div>
                    <h1 className="nd-page-title">{order.orderNumber}</h1>
                    <div className="nd-topbar-sub">
                        {order.customerName} · {order.customerPhoneNumber} · placed {shortDateTime(order.createdAt)}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="nd-btn nd-btn-secondary" onClick={() => navigate('/admin/orders')}>
                        <ArrowBackRoundedIcon style={{ fontSize: 17 }} /> Back
                    </button>
                    {!order.isRewardSent && (
                        <button className="nd-btn nd-btn-primary" onClick={() => setRewardOpen(true)}>
                            <RedeemRoundedIcon style={{ fontSize: 17 }} /> Send reward
                        </button>
                    )}
                </div>
            </div>

            <div className="nd-grid nd-grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
                <div className="nd-kpi"><div className="nd-kpi-label">Status</div>
                    <div style={{ marginTop: 10 }}><Chip tone={ORDER_CHIP[order.status?.statusName] || 'off'}>{order.status?.statusName}</Chip></div>
                </div>
                <div className="nd-kpi"><div className="nd-kpi-label">Total</div><div className="nd-kpi-value">{money(order.totalPrice)}</div></div>
                <div className="nd-kpi"><div className="nd-kpi-label">Shipping</div><div className="nd-kpi-value" style={{ fontSize: 24 }}>{money(order.shippingCost)}</div></div>
                <div className="nd-kpi"><div className="nd-kpi-label">Discounts</div><div className="nd-kpi-value" style={{ fontSize: 24 }}>{money(order.totalDiscount)}</div></div>
            </div>

            <Panel title="Delivery" sub={order.customerNotes || 'No customer notes.'}>
                <div className="nd-field-row">
                    <div>
                        <div className="nd-label">Recipient</div>
                        <div>{order.customerName}</div>
                    </div>
                    <div>
                        <div className="nd-label">Phone</div>
                        <div className="nd-mono">{order.customerPhoneNumber}</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <div className="nd-label">Address</div>
                        <div>{order.shippingAddressLine1}, {order.shippingGovernorate}</div>
                    </div>
                </div>

                <hr className="nd-rule" />
                <div className="nd-field-row" style={{ alignItems: 'end' }}>
                    <div>
                        <div className="nd-label">Advance the order</div>
                        <Select value={newStatusId} onChange={(e) => setNewStatusId(e.target.value)} style={{ minWidth: 220 }}>
                            {statuses.map(s => <option key={s.id} value={s.id}>{s.statusName}</option>)}
                        </Select>
                    </div>
                    <div>
                        <button className="nd-btn nd-btn-secondary" disabled={busy || !newStatusId || newStatusId === order.statusId} onClick={updateStatus}>
                            <LocalShippingRoundedIcon style={{ fontSize: 16 }} /> Update status
                        </button>
                    </div>
                </div>
            </Panel>

            <Panel title={`Items (${items.length})`} sub="What the customer chose.">
                <div className="nd-table-wrap" style={{ border: 'none', borderRadius: 'var(--r-md)' }}>
                    <table className="nd-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Shade</th>
                                <th>SKU</th>
                                <th style={{ textAlign: 'right' }}>Qty</th>
                                <th style={{ textAlign: 'right' }}>Each</th>
                                <th style={{ textAlign: 'right' }}>Line</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(it => (
                                <tr key={it.id}>
                                    <td className="nd-table-strong">{it.variant?.product?.name || it.productId}</td>
                                    <td className="nd-faint">{[it.variant?.colorName, it.variant?.size].filter(Boolean).join(' · ') || '—'}</td>
                                    <td className="nd-mono nd-faint">{it.variant?.sku}</td>
                                    <td className="nd-num" style={{ textAlign: 'right' }}>{it.quantity}</td>
                                    <td className="nd-num" style={{ textAlign: 'right' }}>{money(it.priceAtPurchase)}</td>
                                    <td className="nd-num nd-table-strong" style={{ textAlign: 'right' }}>{money(it.priceAtPurchase * it.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            <Panel title={`Transactions (${transactions.length})`} sub="Payment trail and gateway status.">
                {transactions.length === 0 ? (
                    <div className="nd-empty" style={{ padding: 24 }}>
                        <p style={{ margin: 0 }}>No transactions recorded.</p>
                    </div>
                ) : (
                    <div className="nd-table-wrap" style={{ border: 'none' }}>
                        <table className="nd-table">
                            <thead>
                                <tr>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Gateway ref</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td className="nd-num nd-table-strong">{money(tx.amount)}</td>
                                        <td>
                                            <select className="nd-select" style={{ padding: '4px 8px', fontSize: 13, minWidth: 120 }}
                                                value={tx.status}
                                                onChange={(e) => setTxStatusFor({ id: tx.id, newStatus: e.target.value })}>
                                                {TransactionStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="nd-mono nd-faint">{tx.gatewayTxnId || '—'}</td>
                                        <td className="nd-faint">{shortDateTime(tx.transactionDate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {txStatusFor && (
                    <div style={{ marginTop: 'var(--sp-4)', display: 'flex', gap: 10 }}>
                        <span className="nd-hint">Set transaction to {txStatusFor.newStatus}?</span>
                        <button className="nd-btn nd-btn-secondary nd-btn-sm" onClick={updateTx} disabled={busy}>Confirm</button>
                        <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => setTxStatusFor(null)}>Cancel</button>
                    </div>
                )}
            </Panel>

            <Panel title="Discounts applied" sub={discounts.length ? 'Coupons bonded to this order.' : 'None applied.'}>
                {discounts.map(d => (
                    <div key={d.discountId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: 'var(--step-sm)' }}>
                        <span>{d.discount?.name} <span className="nd-mono nd-faint">({d.discount?.couponCode})</span></span>
                        <span className="nd-num nd-table-strong">−{money(d.amountDeducted)}</span>
                    </div>
                ))}
            </Panel>

            {/* Transaction confirm */}
            <Modal open={!!txStatusFor} onClose={() => setTxStatusFor(null)} title="Transaction status">
                <p style={{ margin: 0 }}>Mark this transaction as <strong style={{ color: 'var(--ink)' }}>{txStatusFor?.newStatus}</strong>?</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--sp-5)' }}>
                    <button className="nd-btn nd-btn-secondary" onClick={() => setTxStatusFor(null)} disabled={busy}>Cancel</button>
                    <button className="nd-btn nd-btn-primary" onClick={updateTx} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</button>
                </div>
            </Modal>

            {/* Reward modal */}
            <Modal open={rewardOpen} onClose={() => setRewardOpen(false)} title="Send a thank-you reward">
                <p className="nd-hint" style={{ margin: '0 0 var(--sp-4)' }}>
                    Generates a one-time CLIENT_REWARD code and delivers it via WhatsApp to {order.customerPhoneNumber}.
                </p>
                <div className="nd-field-row">
                    <Field label="Type">
                        <Select value={reward.discountType} onChange={(e) => setReward(r => ({ ...r, discountType: e.target.value }))}>
                            <option value="PERCENTAGE">Percentage off</option>
                            <option value="FIXED_AMOUNT">Fixed amount (EGP)</option>
                        </Select>
                    </Field>
                    <Field label={reward.discountType === 'PERCENTAGE' ? 'Percent' : 'Amount (EGP)'}>
                        <Input type="number" min="1" value={reward.discountValue} onChange={(e) => setReward(r => ({ ...r, discountValue: e.target.value }))} />
                    </Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--sp-2)' }}>
                    <button className="nd-btn nd-btn-secondary" onClick={() => setRewardOpen(false)} disabled={busy}>Cancel</button>
                    <button className="nd-btn nd-btn-primary" onClick={sendReward} disabled={busy || !reward.discountValue}>
                        <RedeemRoundedIcon style={{ fontSize: 17 }} /> {busy ? 'Sending…' : 'Send via WhatsApp'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default OrderDetailPage;