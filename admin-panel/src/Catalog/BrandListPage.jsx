import React from 'react';
import CatalogPage from './catalogRegistry';
import { brandApi } from '../api/adminApi';
import { mediaSrc } from '../utils/format';

const BrandListPage = () => (
    <CatalogPage
        api={brandApi}
        title="Brands"
        eyebrow="Catalog"
        singular="Brand"
        addLabel="New brand"
        searchKeys={['name', 'slug']}
        fields={[
            { name: 'name', label: 'Brand name', required: true, placeholder: 'e.g. Charlotte Tilbury' },
            { name: 'slug', label: 'Slug', required: true, placeholder: 'charlotte-tilbury', hint: 'Lowercase, hyphenated.' },
            { name: 'logoUrl', label: 'Logo', type: 'upload' },
        ]}
        columns={[
            {
                label: 'Brand',
                render: (row) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {row.logoUrl
                            ? <img src={mediaSrc(row.logoUrl)} alt={row.name} style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 'var(--r-sm)' }} />
                            : <span className="nd-avatar" style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)' }}>{row.name?.[0]?.toUpperCase()}</span>}
                        <span className="nd-table-strong">{row.name}</span>
                    </div>
                ),
            },
            { label: 'Slug', render: (row) => <span className="nd-mono nd-faint">{row.slug}</span> },
        ]}
    />
);

export default BrandListPage;