import React from 'react';
import CatalogPage from './catalogRegistry';
import { collectionApi } from '../api/adminApi';
import { Chip } from '../common/UI';
import { shortDate } from '../utils/format';

const CollectionListPage = () => (
    <CatalogPage
        api={collectionApi}
        title="Collections"
        eyebrow="Catalog"
        singular="Collection"
        addLabel="New collection"
        searchKeys={['name', 'slug', 'description']}
        fields={[
            { name: 'name', label: 'Collection name', required: true, placeholder: 'e.g. The Holiday Edit' },
            { name: 'slug', label: 'Slug', required: true, placeholder: 'holiday-edit' },
            { name: 'description', label: 'Description', type: 'textarea', placeholder: 'What is this edit about?' },
            { name: 'isPublished', label: 'Published', type: 'toggle' },
            { name: 'publishAt', label: 'Publish on', type: 'date' },
            { name: 'endsAt', label: 'Ends at', type: 'date' },
        ]}
        columns={[
            { label: 'Collection', render: (row) => <span className="nd-table-strong">{row.name}</span> },
            { label: 'Slug', render: (row) => <span className="nd-mono nd-faint">{row.slug}</span> },
            { label: 'Status', render: (row) => <Chip tone={row.isPublished ? 'live' : 'off'}>{row.isPublished ? 'Published' : 'Draft'}</Chip> },
            { label: 'Runs', render: (row) => <span className="nd-faint">{shortDate(row.publishAt)}{row.endsAt ? ` → ${shortDate(row.endsAt)}` : ''}</span> },
        ]}
    />
);

export default CollectionListPage;