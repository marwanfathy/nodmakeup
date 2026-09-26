import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { discountApi } from '../api/adminApi';
import useFetchData from '../hooks/useFetchData';
import { errMsg } from '../utils/format';
import { SearchField, Chip, EmptyState, Loading, ErrorBox, Modal, Field, Input, Select, Switch, useConfirmDelete } from '../common/UI';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

const TYPE_LABEL = { PERCENTAGE: '%', FIXED_AMOUNT: 'EGP', FREE_SHIPPING: 'Ship' };

const empty = () => ({
    name: '', couponCode: '', type: 'PERCENTAGE', value: '', isActive: true, maxUsages: '100', assignedPhone: '',
});

const DiscountListPage = () => {
    const [refetchIndex] = useState(0);
    const [query, setQuery] = useState('');
    const { data, loading, error, reload } = useFetchData(discountApi.getAll, refetchIndex);

    const [editing, setEditing] = useState(null);
    const [values, setValues] = useState(empty());
    const [saving, setSaving] = useState(false);
    const { confirm, dialog } = useConfirmDelete(async (row) => {
        await discountApi.delete(row.id);
        toast.success('Discount deleted.');
        reload();
    });

    const rows = (data || []).filter(d =>
        !query || [d.name, d.couponCode, d.category].some(s => String(s || '').toLowerCase().includes(query.toLowerCase())));

    const set = (key, v) => setValues(x => ({ ...x, [key]: v }));

    const openCreate = () => { setValues(empty()); setEditing({}); };
    const openEdit = (row) => setValues({
        name: row.name, couponCode: row.couponCode || '', type: row.type,
        value: String(row.value ?? ''), isActive: row.isActive,
        maxUsages: String(row.maxUsages ?? 1), assignedPhone: row.assignedPhone || '',
    }) || setEditing(row);

    const onSave = async (e) => {
        e.preventDefault();
        if (!values.name.trim() || !values.type || values.value === '' || values.value === null) {
            toast.error('Name, type and value are required.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: values.name.trim(),
                couponCode: values.couponCode.trim() || null,
                type: values.type,
                value: parseFloat(values.value),
                isActive: values.type === 'FREE_SHIPPING' ? true : values.isActive,
                maxUsages: parseInt(values.maxUsages || '1', 10) || 1,
                assignedPhone: values.assignedPhone.trim() || null,
            };
            if (editing.id) await discountApi.update(editing.id, payload);
            else await discountApi.create(payload);
            toast.success(editing.id ? 'Discount updated.' : 'Discount created.');
            setEditing(null);
            reload();
        } catch (err) {
            toast.error(errMsg(err, 'Save failed.'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loading label="Loading discounts…" />;
    if (error) return <ErrorBox message={error} onRetry={reload} />;

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Commerce</div>
                    <h1 className="nd-page-title">Discounts</h1>
                    <div className="nd-topbar-sub">{rows.length} offer{rows.length === 1 ? '' : 's'}</div>
                </div>
                <button className="nd-btn nd-btn-primary" onClick={openCreate}>
                    <AddRoundedIcon style={{ fontSize: 18 }} /> New discount
                </button>
            </div>

            <div className="nd-toolbar">
                <SearchField value={query} onChange={setQuery} placeholder="Search by name, code…" />
            </div>

            {rows.length === 0 ? (
                <EmptyState title={query ? 'Nothing matches' : 'No discounts yet'} sub={query ? 'Try again.' : 'Create your first offer.'}
                    action={!query && <button className="nd-btn nd-btn-primary" onClick={openCreate}><AddRoundedIcon style={{ fontSize: 18 }} /> New discount</button>} />
            ) : (
                <div className="nd-table-wrap">
                    <table className="nd-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Offer</th>
                                <th>Code</th>
                                <th style={{ textAlign: 'right' }}>Value</th>
                                <th style={{ textAlign: 'right' }}>Usage</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th className="nd-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((d, i) => (
                                <tr key={d.id}>
                                    <td className="nd-index">0{(i + 1).toString().padStart(2, '0')}</td>
                                    <td className="nd-table-strong">{d.name}</td>
                                    <td className="nd-mono">{d.couponCode || '—'}</td>
                                    <td className="nd-num" style={{ textAlign: 'right' }}>
                                        {d.type === 'FREE_SHIPPING' ? 'Free shipping' : `${TYPE_LABEL[d.type]} ${d.value}`}
                                    </td>
                                    <td className="nd-num nd-faint" style={{ textAlign: 'right' }}>{d.currentUsages} / {d.maxUsages}</td>
                                    <td><span className="nd-chip is-steel" style={{ textTransform: 'none' }}>{d.category}</span></td>
                                    <td><Chip tone={d.isActive ? 'live' : 'off'}>{d.isActive ? 'Active' : 'Paused'}</Chip></td>
                                    <td className="nd-actions">
                                        <button className="nd-btn-icon" onClick={() => openEdit(d)} aria-label="Edit"><EditRoundedIcon style={{ fontSize: 17 }} /></button>
                                        <button className="nd-btn-icon danger" onClick={() => confirm({ node: d, label: d.name })} aria-label="Delete"><span style={{ fontSize: 15 }}>✕</span></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal open={!!editing} onClose={() => !saving && setEditing(null)} title={`${editing?.id ? 'Edit' : 'New'} discount`}>
                <form onSubmit={onSave} noValidate>
                    <Field label="Offer name" required>
                        <Input value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Welcome 10%" invalid={!values.name.trim()} />
                    </Field>
                    <div className="nd-field-row">
                        <Field label="Coupon code" hint="Leave blank for automatic discounts.">
                            <Input className="nd-mono" value={values.couponCode} onChange={(e) => set('couponCode', e.target.value)} placeholder="WELCOME10" />
                        </Field>
                        <Field label="Category" hint="Locking phone targets only that customer.">
                            <Select value={values.assignedPhone ? 'CLIENT_REWARD' : 'PUBLIC'} onChange={(e) => set('assignedPhone', e.target.value === 'CLIENT_REWARD' ? values.assignedPhone || '__locked__' : '')}>
                                <option value="PUBLIC">PUBLIC</option>
                                <option value="CLIENT_REWARD">CLIENT_REWARD</option>
                            </Select>
                        </Field>
                    </div>
                    <div className="nd-field-row">
                        <Field label="Type" required>
                            <Select value={values.type} onChange={(e) => set('type', e.target.value)}>
                                <option value="PERCENTAGE">Percentage off</option>
                                <option value="FIXED_AMOUNT">Fixed amount (EGP)</option>
                                <option value="FREE_SHIPPING">Free shipping</option>
                            </Select>
                        </Field>
                        <Field label={values.type === 'FIXED_AMOUNT' ? 'Amount (EGP)' : values.type === 'FREE_SHIPPING' ? '—' : 'Percent'} required={values.type !== 'FREE_SHIPPING'}>
                            {values.type === 'FREE_SHIPPING' ? (
                                <span className="nd-hint">Shipping covered on checkout.</span>
                            ) : (
                                <Input type="number" min="0" value={values.value} onChange={(e) => set('value', e.target.value)} />
                            )}
                        </Field>
                        <Field label="Max uses">
                            <Input type="number" min="1" value={values.maxUsages} onChange={(e) => set('maxUsages', e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Lock to phone" hint="Only this phone number can redeem.">
                        <Input className="nd-mono" value={values.assignedPhone === '__locked__' || values.assignedPhone ? (values.assignedPhone === '__locked__' ? '' : values.assignedPhone) : ''} onChange={(e) => set('assignedPhone', e.target.value.trim())} placeholder="01012345678" />
                    </Field>
                    <div className="nd-switch-row" style={{ marginBottom: 'var(--sp-5)' }}>
                        <span className="nd-label" style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Active (redeemable)</span>
                        <Switch checked={values.isActive} onChange={(v) => set('isActive', v)} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button type="button" className="nd-btn nd-btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                        <button type="submit" className="nd-btn nd-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                </form>
            </Modal>

            {dialog}
        </div>
    );
};

export default DiscountListPage;