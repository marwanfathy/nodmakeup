import React, { useState } from 'react';
import { toast } from 'react-toastify';
import useFetchData from '../hooks/useFetchData';
import { errMsg, mediaSrc } from '../utils/format';
import { SearchField, EmptyState, Loading, ErrorBox, Modal, Field, Input, Textarea, Switch, UploadTile, useConfirmDelete } from '../common/UI';
import { mediaApi } from '../api/adminApi';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

const serializeValues = (values, fields) => {
    const body = {};
    for (const f of fields) {
        const v = values[f.name];
        if (f.type === 'date') body[f.name] = v || null;
        else if (f.type === 'toggle') body[f.name] = !!v;
        else body[f.name] = f.required ? String(v ?? '').trim() : (v || null);
    }
    return body;
};

const CatalogPage = ({ api, fields, columns, title, eyebrow, searchKeys = [], addLabel = 'New', singular }) => {
    const [refetchIndex] = useState(0);
    const [query, setQuery] = useState('');
    const { data, loading, error, reload } = useFetchData(api.getAll, refetchIndex);

    const [editing, setEditing] = useState(null);   // row being edited, or { } for create
    const [values, setValues] = useState({});
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirm, dialog } = useConfirmDelete(async (row) => {
        await api.delete(row.id);
        toast.success(`${singular} deleted.`);
        reload();
    });

    const rows = (data || []).filter(row =>
        !query || searchKeys.some(k => String(row[k] || '').toLowerCase().includes(query.toLowerCase())));

    const openCreate = () => {
        const init = {};
        for (const f of fields) {
            if (f.type === 'toggle') init[f.name] = false;
            else if (f.type === 'date') init[f.name] = '';
            else init[f.name] = '';
        }
        setValues(init);
        setEditing({});
    };

    const openEdit = (row) => {
        const init = {};
        for (const f of fields) init[f.name] = row[f.name] ?? '';
        setValues(init);
        setEditing(row);
    };

    const setValue = (name, pre) => setValues(v => ({ ...v, [name]: pre }));

    const onSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = serializeValues(values, fields);
            const missing = fields.filter(f => f.required && f.type !== 'toggle' && !String(values[f.name] || '').trim());
            if (missing.length) {
                toast.error(`${missing[0].label || missing[0].name} is required.`);
                setSaving(false);
                return;
            }
            if (editing.id) await api.update(editing.id, payload);
            else await api.create(payload);
            toast.success(`${singular} ${editing.id ? 'updated' : 'created'}.`);
            setEditing(null);
            reload();
        } catch (err) {
            toast.error(errMsg(err, `Failed to save ${singular.toLowerCase()}.`));
        } finally {
            setSaving(false);
        }
    };

    const onFile = async (file, name) => {
        if (!file) return;
        setUploading(true);
        try {
            const res = await mediaApi.uploadProductImage(file);
            setValue(name, res.url);
        } catch (err) {
            toast.error(errMsg(err, 'Upload failed.'));
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <Loading label={`Loading ${title.toLowerCase()}…`} />;
    if (error) return <ErrorBox message={error} onRetry={reload} />;

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
                    <h1 className="nd-page-title">{title}</h1>
                    <div className="nd-topbar-sub">{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</div>
                </div>
                <button className="nd-btn nd-btn-primary" onClick={openCreate}>
                    <AddRoundedIcon style={{ fontSize: 18 }} /> {addLabel}
                </button>
            </div>

            <div className="nd-toolbar">
                <SearchField value={query} onChange={setQuery} placeholder={`Search ${title.toLowerCase()}…`} />
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    title={query ? 'Nothing matches' : `No ${singular.toLowerCase()} yet`}
                    sub={query ? 'Try a different search.' : `Create the first ${singular.toLowerCase()}.`}
                    action={!query && <button className="nd-btn nd-btn-primary" onClick={openCreate}><AddRoundedIcon style={{ fontSize: 18 }} /> {addLabel}</button>}
                />
            ) : (
                <div className="nd-table-wrap">
                    <table className="nd-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                {columns.map(c => <th key={c.label}>{c.label}</th>)}
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={row.id}>
                                    <td className="nd-index">0{(i + 1).toString().padStart(2, '0')}</td>
                                    {columns.map(c => <td key={c.label}>{c.render(row, i)}</td>)}
                                    <td className="nd-actions">
                                        <button className="nd-btn-icon" onClick={() => openEdit(row)} aria-label={`Edit ${singular}`}><EditRoundedIcon style={{ fontSize: 17 }} /></button>
                                        <button className="nd-btn-icon danger" onClick={() => confirm({ node: row, label: row.name || row.title })} aria-label={`Delete ${singular}`}>
                                            <span style={{ fontSize: 15 }}>✕</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                open={!!editing}
                onClose={() => !saving && setEditing(null)}
                title={`${editing?.id ? `Edit` : `New`} ${singular}`}
                footer={null}
            >
                <form onSubmit={onSave} noValidate>
                    {fields.map(f => (
                        <Field key={f.name} label={f.label} required={f.required} hint={f.hint}>
                            {f.type === 'toggle' ? (
                                <Switch
                                    checked={!!values[f.name]}
                                    onChange={(v) => setValue(f.name, v)}
                                    label={f.label}
                                />
                            ) : f.type === 'textarea' ? (
                                <Textarea value={values[f.name] || ''} onChange={(e) => setValue(f.name, e.target.value)} placeholder={f.placeholder} />
                            ) : f.type === 'upload' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {values[f.name] && <img src={mediaSrc(values[f.name])} alt={f.label} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)' }} />}
                                    <UploadTile src={values[f.name]} onFile={(file) => onFile(file, f.name)} onRemove={() => setValue(f.name, '')} />
                                    {uploading && <span className="nd-hint">Uploading…</span>}
                                </div>
                            ) : f.type === 'date' ? (
                                <Input type="datetime-local" value={values[f.name] || ''} onChange={(e) => setValue(f.name, e.target.value)} />
                            ) : (
                                <Input
                                    value={values[f.name] || ''}
                                    onChange={(e) => setValue(f.name, e.target.value)}
                                    placeholder={f.placeholder}
                                    invalid={f.required && !String(values[f.name] || '').trim()}
                                />
                            )}
                        </Field>
                    ))}

                    <div className="nd-modal-foot" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0 }}>
                        <button type="button" className="nd-btn nd-btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                        <button type="submit" className="nd-btn nd-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                </form>
            </Modal>

            {dialog}
        </div>
    );
};

export default CatalogPage;