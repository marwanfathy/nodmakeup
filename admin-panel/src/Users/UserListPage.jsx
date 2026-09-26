import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { adminUserApi } from '../api/adminApi';
import useFetchData from '../hooks/useFetchData';
import { errMsg, initials, shortDate } from '../utils/format';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Loading, ErrorBox, EmptyState, Modal, Field, Input, useConfirmDelete } from '../common/UI';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

const UserListPage = () => {
    const [refetchIndex] = useState(0);
    const { data, loading, error, reload } = useFetchData(adminUserApi.getAll, refetchIndex);
    const { admin: me } = useAdminAuth();
    const { confirm, dialog } = useConfirmDelete(async (row) => {
        await adminUserApi.delete(row.id);
        toast.success('Admin removed.');
        reload();
    });

    const [open, setOpen] = useState(false);
    const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '' });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setValues(x => ({ ...x, [k]: v }));

    const onSave = async (e) => {
        e.preventDefault();
        if (!values.firstName.trim() || !values.lastName.trim() || !values.email.trim() || !values.password) {
            toast.error('All fields are required.');
            return;
        }
        setSaving(true);
        try {
            await adminUserApi.create({
                firstName: values.firstName.trim(),
                lastName: values.lastName.trim(),
                email: values.email.trim(),
                password: values.password,
            });
            toast.success('Staff member added.');
            setOpen(false);
            setValues({ firstName: '', lastName: '', email: '', password: '' });
            reload();
        } catch (err) {
            toast.error(errMsg(err, 'Could not create admin.'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loading label="Fetching staff…" />;
    if (error) return <ErrorBox message={error} onRetry={reload} />;

    const users = data || [];

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>System</div>
                    <h1 className="nd-page-title">Admins</h1>
                    <div className="nd-topbar-sub">{users.length} staff member{users.length === 1 ? '' : 's'}</div>
                </div>
                <button className="nd-btn nd-btn-primary" onClick={() => setOpen(true)}>
                    <AddRoundedIcon style={{ fontSize: 18 }} /> Add staff
                </button>
            </div>

            {users.length === 0 ? (
                <EmptyState title="No staff yet" sub="Add the first member of the studio." />
            ) : (
                <div className="nd-table-wrap">
                    <table className="nd-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Member</th>
                                <th>Email</th>
                                <th>Joined</th>
                                <th>Role</th>
                                <th className="nd-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u, i) => (
                                <tr key={u.id}>
                                    <td className="nd-index">0{(i + 1).toString().padStart(2, '0')}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span className="nd-avatar">{initials(u.firstName, u.lastName)}</span>
                                            <span className="nd-table-strong">{u.firstName} {u.lastName}</span>
                                        </div>
                                    </td>
                                    <td className="nd-mono">{u.email}</td>
                                    <td className="nd-faint">{shortDate(u.createdAt)}</td>
                                    <td><span className="nd-chip is-steel">Admin</span></td>
                                    <td className="nd-actions">
                                        {me?.id === u.id ? (
                                            <span className="nd-hint">You</span>
                                        ) : (
                                            <button className="nd-btn-icon danger" onClick={() => confirm({ node: u, label: `${u.firstName} ${u.lastName}` })} aria-label="Remove">
                                                <span style={{ fontSize: 15 }}>✕</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal open={open} onClose={() => !saving && setOpen(false)} title="Add a staff member">
                <form onSubmit={onSave} noValidate>
                    <div className="nd-field-row">
                        <Field label="First name" required>
                            <Input value={values.firstName} onChange={(e) => set('firstName', e.target.value)} />
                        </Field>
                        <Field label="Last name" required>
                            <Input value={values.lastName} onChange={(e) => set('lastName', e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Email" required>
                        <Input type="email" value={values.email} onChange={(e) => set('email', e.target.value)} placeholder="staff@nodmakeup.com" />
                    </Field>
                    <Field label="Temporary password" required hint="Shares access; encourage changing later.">
                        <Input type="password" value={values.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button type="button" className="nd-btn nd-btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
                        <button type="submit" className="nd-btn nd-btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add member'}</button>
                    </div>
                </form>
            </Modal>

            {dialog}
        </div>
    );
};

export default UserListPage;