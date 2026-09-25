import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { heroSectionApi } from '../api/adminApi';
import useFetchData from '../hooks/useFetchData';
import { errMsg, shortDate, mediaSrc } from '../utils/format';
import { Chip, EmptyState, Loading, ErrorBox, useConfirmDelete } from '../common/UI';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';

const HeroSectionListPage = () => {
    const [refetchIndex] = useState(0);
    const { data, loading, error, reload } = useFetchData(heroSectionApi.getAll, refetchIndex);
    const { confirm, dialog } = useConfirmDelete(async (row) => {
        await heroSectionApi.delete(row.id);
        toast.success('Hero section deleted.');
        reload();
    });

    const toggleActive = async (row) => {
        try {
            await heroSectionApi.update(row.id, { ...row, isActive: !row.isActive });
            toast.success(row.isActive ? 'Section taken off the site.' : 'Section is now live.');
            reload();
        } catch (err) {
            toast.error(errMsg(err, 'Could not toggle status.'));
        }
    };

    if (loading) return <Loading label="Opening the campaign board…" />;
    if (error) return <ErrorBox message={error} onRetry={reload} />;

    const sections = data || [];

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Content</div>
                    <h1 className="nd-page-title">Hero Sections</h1>
                    <div className="nd-topbar-sub">{sections.length} campaign{sections.length === 1 ? '' : 's'}</div>
                </div>
                <Link className="nd-btn nd-btn-primary" to="new">
                    <AddRoundedIcon style={{ fontSize: 18 }} /> New section
                </Link>
            </div>

            {sections.length === 0 ? (
                <EmptyState title="The stage is empty" sub="Compose the first thing visitors see — a campaign, its slides, its layers."
                    action={<Link className="nd-btn nd-btn-primary" to="new"><AddRoundedIcon style={{ fontSize: 18 }} /> New section</Link>} />
            ) : (
                <div className="nd-grid nd-grid-3">
                    {sections.map(row => {
                        const slideCount = (row.slides || []).length;
                        const preview = row.slides?.find(s => s.thumbnailUrl)?.thumbnailUrl;
                        return (
                            <article key={row.id} className="nd-card nd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                                <div style={{ position: 'relative', aspectRatio: '16 / 6.5', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--paper-deep)' }}>
                                    {preview
                                        ? <img src={mediaSrc(preview)} alt={row.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="nd-empty-mark"><span style={{ fontFamily: 'var(--font-serif)', fontSize: 15 }}>{slideCount}</span></span>
                                        </div>}
                                    <span className="nd-chip is-count" style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(10,10,10,0.85)' }}>
                                        {slideCount} slide{slideCount === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div>
                                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--step-t3)', fontWeight: 600, margin: '0 0 2px' }}>{row.title}</h3>
                                    <div className="nd-mono nd-faint" style={{ fontSize: 'var(--step-caption)' }}>/{row.slug}</div>
                                    {row.description && <p className="nd-faint" style={{ fontSize: 'var(--step-sm)', margin: '6px 0 0' }}>{row.description}</p>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--hairline)', marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Chip tone={row.isActive ? 'live' : 'off'}>{row.isActive ? 'Live' : 'Offline'}</Chip>
                                        <span className="nd-faint" style={{ fontSize: 'var(--step-caption)' }}>Updated {shortDate(row.updatedAt)}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <Link className="nd-btn-icon" to={`edit/${row.id}`} aria-label="Edit"><EditRoundedIcon style={{ fontSize: 17 }} /></Link>
                                        <button className="nd-btn-icon" onClick={() => toggleActive(row)} aria-label="Toggle visibility">
                                            {row.isActive ? <VisibilityOffRoundedIcon style={{ fontSize: 17 }} /> : <VisibilityRoundedIcon style={{ fontSize: 17 }} />}
                                        </button>
                                        <button className="nd-btn-icon danger" onClick={() => confirm({ node: row, label: row.title })} aria-label="Delete">
                                            <span style={{ fontSize: 15 }}>✕</span>
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {dialog}
        </div>
    );
};

export default HeroSectionListPage;