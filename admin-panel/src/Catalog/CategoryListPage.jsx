import React from 'react';
import CatalogPage from './catalogRegistry';
import { categoryApi } from '../api/adminApi';
import { Chip } from '../common/UI';
import { mediaSrc } from '../utils/format';

const CategoryListPage = () => (
    <CatalogPage
        api={categoryApi}
        title="Categories"
        eyebrow="Catalog"
        singular="Category"
        addLabel="New category"
        searchKeys={['name', 'slug']}
        fields={[
            { name: 'name', label: 'Category name', required: true, placeholder: 'e.g. Lipsticks' },
            { name: 'slug', label: 'Slug', required: true, placeholder: 'lipsticks', hint: 'Lowercase, hyphenated.' },
            { name: 'imageUrl', label: 'Cover image', type: 'upload' },
            { name: 'isActive', label: 'Visible on storefront', type: 'toggle' },
        ]}
        columns={[
            {
                label: 'Category',
                render: (row) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {row.imageUrl
                            ? <img src={mediaSrc(row.imageUrl)} alt={row.name} style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 'var(--r-sm)' }} />
                            : <span className="nd-avatar" style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)' }}>{row.name?.[0]?.toUpperCase()}</span>}
                        <span className="nd-table-strong">{row.name}</span>
                    </div>
                ),
            },
            { label: 'Slug', render: (row) => <span className="nd-mono nd-faint">{row.slug}</span> },
            { label: 'Status', render: (row) => <Chip tone={row.isActive ? 'live' : 'off'}>{row.isActive ? 'Live' : 'Hidden'}</Chip> },
        ]}
    />
);

export default CategoryListPage;