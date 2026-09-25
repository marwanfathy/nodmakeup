import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { productApi } from '../api/adminApi';
import useFetchData from '../hooks/useFetchData';
import { errMsg, mediaSrc } from '../utils/format';
import { SearchField, Chip, EmptyState, Loading, ErrorBox, useConfirmDelete } from '../common/UI';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';

const ProductListPage = () => {
    const [refetchIndex] = useState(0);
    const [query, setQuery] = useState('');
    const { data, loading, error, reload } = useFetchData(productApi.getAll, refetchIndex);
    const { confirm, dialog } = useConfirmDelete(async (row) => {
        await productApi.delete(row.product_id);
        toast.success('Product deleted.');
        reload();
    });

    const rows = (data || []).filter(p =>
        !query || [p.name, p.brand_name, p.product_id].some(s => String(s || '').toLowerCase().includes(query.toLowerCase())));

    const toggleArchive = async (row) => {
        try {
            if (row.is_archived) await productApi.unarchive(row.product_id);
            else await productApi.archive(row.product_id);
            toast.success(row.is_archived ? 'Product restored.' : 'Product archived.');
            reload();
        } catch (err) {
            toast.error(errMsg(err, 'Action failed.'));
        }
    };

    if (loading) return <Loading label="Gathering the catalogue…" />;
    if (error) return <ErrorBox message={error} onRetry={reload} />;

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Catalog</div>
                    <h1 className="nd-page-title">Products</h1>
                    <div className="nd-topbar-sub">{rows.length} in the catalogue</div>
                </div>
                <Link className="nd-btn nd-btn-primary" to="new">
                    <AddRoundedIcon style={{ fontSize: 18 }} /> New product
                </Link>
            </div>

            <div className="nd-toolbar">
                <SearchField value={query} onChange={setQuery} placeholder="Search products by name, brand…" />
                <span className="nd-chip is-count">{rows.length} shown</span>
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    title={query ? 'No products match' : 'The shelves are empty'}
                    sub={query ? 'Try a different name or brand.' : 'Create the first product to begin the collection.'}
                    action={!query && <Link className="nd-btn nd-btn-primary" to="new"><AddRoundedIcon style={{ fontSize: 18 }} /> New product</Link>}
                />
            ) : (
                <div className="nd-table-wrap">
                    <table className="nd-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product</th>
                                <th>Brand</th>
                                <th style={{ textAlign: 'right' }}>Stock</th>
                                <th>Status</th>
                                <th className="nd-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((p, i) => (
                                <tr key={p.product_id}>
                                    <td className="nd-index">0{(i + 1).toString().padStart(2, '0')}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {p.first_image
                                                ? <img src={mediaSrc(p.first_image)} alt={p.name} style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)' }} />
                                                : <span className="nd-avatar" style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)' }}>{p.name?.[0]?.toUpperCase()}</span>}
                                            <Link className="nd-link" to={`edit/${p.product_id}`}>{p.name}</Link>
                                        </div>
                                    </td>
                                    <td className="nd-faint">{p.brand_name}</td>
                                    <td className="nd-num" style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {p.total_stock}
                                        <span className="nd-faint" style={{ fontWeight: 400 }}>
                                            {p.total_stock > 0 && p.total_stock <= 10 ? ' · low' : ''}
                                        </span>
                                    </td>
                                    <td>
                                        <Chip tone={p.is_archived ? 'off' : (p.is_active ? 'live' : 'pending')}>
                                            {p.is_archived ? 'Archived' : (p.is_active ? 'Live' : 'Draft')}
                                        </Chip>
                                    </td>
                                    <td className="nd-actions">
                                        <Link className="nd-btn-icon" to={`edit/${p.product_id}`} aria-label="Edit">
                                            <EditRoundedIcon style={{ fontSize: 17 }} />
                                        </Link>
                                        <button className="nd-btn-icon" onClick={() => toggleArchive(p)} aria-label="Archive or restore">
                                            {p.is_archived
                                                ? <VisibilityRoundedIcon style={{ fontSize: 17 }} />
                                                : <VisibilityOffRoundedIcon style={{ fontSize: 17 }} />}
                                        </button>
                                        <button className="nd-btn-icon danger" onClick={() => confirm({ node: p, label: p.name })} aria-label="Delete">
                                            <span style={{ fontSize: 15 }}>✕</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {dialog}
        </div>
    );
};

export default ProductListPage;