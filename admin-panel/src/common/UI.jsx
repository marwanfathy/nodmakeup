import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { mediaSrc } from '../utils/format';

/* ---------- Page head ---------- */
export const PageHead = ({ eyebrow, title, sub, actions }) => (
    <div className="nd-page-head">
        <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
            <h1 className="nd-page-title">{title}</h1>
            {sub && <div className="nd-topbar-sub">{sub}</div>}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
);

/* ---------- In-content head (fallback when header is global) ---------- */
export const SegmentTitle = ({ eyebrow, title, actions }) => (
    <div className="nd-page-head">
        <div>
            {eyebrow && <div className="nd-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
            <h1 className="nd-title1" style={{ display: 'inline-block' }}>{title}</h1>
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{actions}</div>}
    </div>
);

/* ---------- Create button (editorial) ---------- */
export const CreateButton = ({ to, label = 'New' }) => {
    const navigate = useNavigate();
    return (
        <button className="nd-btn nd-btn-primary" onClick={() => navigate(to)}>
            <AddRoundedIcon style={{ fontSize: 18 }} /> {label}
        </button>
    );
};

/* ---------- Search field ---------- */
export const SearchField = ({ value, onChange, placeholder = 'Search…' }) => (
    <div className="nd-search">
        <span className="nd-search-ico"><SearchRoundedIcon style={{ fontSize: 16 }} /></span>
        <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
        />
        {value && (
            <button className="nd-search-clear" onClick={() => onChange('')} aria-label="Clear search">
                <CloseRoundedIcon style={{ fontSize: 14 }} />
            </button>
        )}
    </div>
);

/* ---------- Swatch chip ---------- */
export const Chip = ({ tone = 'off', children }) => (
    <span className={`nd-chip ${tone ? `is-${tone}` : ''}`}>{children}</span>
);

/* ---------- Loading / error / empty ---------- */
export const Loading = ({ label = 'Loading…' }) => (
    <div className="nd-loading"><span className="nd-spinner" /> {label}</div>
);

export const ErrorBox = ({ message, onRetry }) => (
    <div className="nd-error-box">
        <h2 className="nd-title3" style={{ margin: '0 0 8px' }}>Couldn't load this page</h2>
        <p className="nd-muted" style={{ margin: '0 0 18px' }}>{message}</p>
        {onRetry && (
            <button className="nd-btn nd-btn-secondary" onClick={onRetry}>
                <ReplayRoundedIcon style={{ fontSize: 16 }} /> Retry
            </button>
        )}
    </div>
);

export const EmptyState = ({ title, sub, action }) => (
    <div className="nd-empty">
        <div className="nd-empty-mark"><AddRoundedIcon /></div>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
        {action}
    </div>
);

/* ---------- Panel wrapper ---------- */
export const Panel = ({ title, sub, actions, children }) => (
    <section className="nd-panel">
        {(title || actions) && (
            <div className="nd-panel-head">
                <div>
                    {title && <h2 className="nd-panel-title">{title}</h2>}
                    {sub && <p className="nd-panel-sub">{sub}</p>}
                </div>
                {actions}
            </div>
        )}
        {children}
    </section>
);

/* ---------- Form field ---------- */
export const Field = ({ label, required, error, hint, style, children, className = '' }) => (
    <div className={`nd-field ${className}`} style={style}>
        {label && (
            <label className="nd-label">
                {label}
                {required && <span className="nd-req">*</span>}
            </label>
        )}
        {children}
        {hint && !error && <span className="nd-hint">{hint}</span>}
        {error && <span className="nd-field-error">{error}</span>}
    </div>
);

export const Input = (props) => <input className={`nd-input ${props.invalid ? 'is-invalid' : ''}`} {...props} />;
export const Textarea = (props) => <textarea className={`nd-textarea ${props.invalid ? 'is-invalid' : ''}`} {...props} />;
export const Select = ({ children, invalid, className = '', ...props }) => (
    <select className={`nd-select ${invalid ? 'is-invalid' : ''} ${className}`} {...props}>{children}</select>
);

export const Switch = ({ checked, onChange, label }) => (
    <div className="nd-switch-row" style={{ width: '100%' }}>
        {label && <span style={{ fontSize: 'var(--step-sm)', fontWeight: 600 }}>{label}</span>}
        <label className="nd-switch">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        </label>
    </div>
);

export const Segmented = ({ options, value, onChange }) => (
    <div className="nd-segmented">
        {options.map(opt => (
            <button key={opt.value} type="button" className={value === opt.value ? 'active' : ''} onClick={() => onChange(opt.value)}>
                {opt.label}
            </button>
        ))}
    </div>
);

/* ---------- KPI ---------- */
export const Kpi = ({ label, value, delta, deltaTone = 'up' }) => (
    <div className="nd-kpi">
        <div className="nd-kpi-label">{label}</div>
        <div className="nd-kpi-value">{value}</div>
        {delta !== undefined && <div className={`nd-kpi-delta ${deltaTone}`}>{delta}</div>}
    </div>
);

/* ---------- Pagination ---------- */
export const Pagination = ({ page, totalPages, total, onPage }) => (
    <div className="nd-pagination">
        <span className="nd-pagination-meta">
            {total} record{total === 1 ? '' : 's'} · page {page} of {Math.max(totalPages, 1)}
        </span>
        <div className="nd-pagination-pages">
            <button className="nd-btn nd-btn-secondary nd-btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
            <button className="nd-btn nd-btn-secondary nd-btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
        </div>
    </div>
);

/* ---------- Menu popover ---------- */
export const Menu = ({ anchorEl, onClose, children }) => {
    if (!anchorEl) return null;
    const rect = anchorEl.getBoundingClientRect();
    return (
        <div className="nd-menu" style={{ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) }} onClick={onClose}>
            {children}
        </div>
    );
};

export const MenuItem = ({ icon, onClick, danger, children }) => (
    <button type="button" className={`nd-menu-item ${danger ? 'danger' : ''}`} onClick={onClick}>
        {icon && <span className="nd-mi-ico">{icon}</span>}
        {children}
    </button>
);

/* ---------- Modal + confirm ---------- */
export const Modal = ({ open, onClose, title, children, footer }) => {
    if (!open) return null;
    return (
        <div className="nd-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="nd-modal" role="dialog" aria-modal="true">
                <div className="nd-modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 className="nd-modal-title">{title}</h3>
                    <button className="nd-btn-icon" onClick={onClose} aria-label="Close"><CloseRoundedIcon style={{ fontSize: 18 }} /></button>
                </div>
                <div className="nd-modal-body">{children}</div>
                {footer && <div className="nd-modal-foot">{footer}</div>}
            </div>
        </div>
    );
};

export const useConfirmDelete = (onDelete, busyText = 'Deleting…') => {
    const [target, setTarget] = useState(null);
    const [busy, setBusy] = useState(false);
    const confirm = (node) => setTarget(node);
    const dialog = target ? (
        <Modal open={!!target} onClose={() => !busy && setTarget(null)} title="Delete permanently?">
            <p style={{ margin: 0 }}>
                This will remove <strong style={{ color: 'var(--ink)' }}>{target.label || 'this item'}</strong>.
                The action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--sp-5)' }}>
                <button className="nd-btn nd-btn-secondary" onClick={() => setTarget(null)} disabled={busy}>Cancel</button>
                <button className="nd-btn nd-btn-danger" disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await onDelete(target.node);
                            setTarget(null);
                        } finally {
                            setBusy(false);
                        }
                    }}>
                    {busy ? busyText : 'Delete'}
                </button>
            </div>
        </Modal>
    ) : null;
    return { confirm, dialog };
};

/* ---------- Tabs ---------- */
export const Tabs = ({ tabs, active, onChange }) => (
    <div className="nd-tabs">
        {tabs.map(t => (
            <button key={t.value} className={`nd-tab ${active === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
                {t.label}
            </button>
        ))}
    </div>
);

/* ---------- Upload tile ---------- */
export const UploadTile = ({ src, onRemove, onFile, label, busy }) => (
    <span className={`nd-upload-tile ${busy ? 'busy' : ''}`} title={label || 'Upload'}>
        {src && <img src={mediaSrc(src)} alt={label || 'uploaded'} />}
        {busy && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,6,8,0.72)', zIndex: 3 }}>
                <span className="nd-spinner" style={{ width: 18, height: 18 }} />
            </div>
        )}
        {onRemove && src && (
            <button type="button" className="nd-ut-x" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }} aria-label="Remove">
                <CloseRoundedIcon style={{ fontSize: 12 }} />
            </button>
        )}
        <input type="file" accept={label ? undefined : 'image/*'} onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
        }} />
    </span>
);