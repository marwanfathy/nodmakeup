import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { storyApi, mediaApi } from '../api/adminApi';
import useFetchData from '../hooks/useFetchData';
import { errMsg, timeAgo, initials, mediaSrc } from '../utils/format';
import { Loading, ErrorBox, EmptyState, Modal, useConfirmDelete } from '../common/UI';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

const StoryManagementPage = () => {
    const [refetchIndex] = useState(0);
    const { data: stories, loading, error, reload } = useFetchData(storyApi.getAll, refetchIndex);
    const { confirm, dialog } = useConfirmDelete(async (row) => {
        await storyApi.delete(row.id);
        toast.success('Story removed.');
        reload();
    });

    const [open, setOpen] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);

    const onFiles = (fileList) => {
        const files = Array.from(fileList);
        setPendingFiles(prev => [...prev, ...files.map(f => ({
            file: f, uploading: false, url: '', thumbnailUrl: '',
            mediaType: f.type.startsWith('video') ? 'video' : 'image',
        }))]);
        setOpen(true);
    };

    const uploadOne = async (index) => {
        const item = pendingFiles[index];
        if (!item || item.uploading || item.url) return;
        const next = [...pendingFiles];
        next[index] = { ...item, uploading: true };
        setPendingFiles(next);
        try {
            const res = await mediaApi.uploadStory(item.file);
            setPendingFiles(prev => prev.map((p, i) => i === index
                ? { ...p, uploading: false, url: res.url, thumbnailUrl: res.thumbnailUrl } : p));
        } catch (err) {
            toast.error(errMsg(err, 'Story upload failed.'));
            setPendingFiles(prev => prev.map((p, i) => i === index ? { ...p, uploading: false } : p));
        }
    };

    const publish = async () => {
        const ready = pendingFiles.filter(p => p.url);
        const uploadingNow = pendingFiles.some(p => p.uploading || (!p.url && pendingFiles.length > 0));
        if (ready.length === 0 || uploadingNow) {
            toast.error('Wait for uploads to finish.');
            return;
        }
        try {
            const body = ready.map(p => ({
                mediaUrl: p.url,
                mediaType: p.mediaType,
                thumbnailUrl: p.thumbnailUrl || null,
            }));
            await storyApi.create(body);
            toast.success(`${body.length} story${body.length === 1 ? '' : 's'} published for 24h.`);
            setOpen(false);
            setPendingFiles([]);
            reload();
        } catch (err) {
            toast.error(errMsg(err, 'Publish failed.'));
        }
    };

    const removePending = (index) => setPendingFiles(prev => prev.filter((_, i) => i !== index));

    if (loading) return <Loading label="Fetching stories…" />;
    if (error) return <ErrorBox message={error} onRetry={reload} />;

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Content</div>
                    <h1 className="nd-page-title">Stories</h1>
                    <div className="nd-topbar-sub">Ephemeral moments, live for 24 hours.</div>
                </div>
                <label className="nd-btn nd-btn-primary" style={{ cursor: 'pointer' }}>
                    <AddRoundedIcon style={{ fontSize: 18 }} /> Add stories
                    <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
                </label>
            </div>

            {stories.length === 0 ? (
                <EmptyState title="No stories in rotation" sub="Add a story to place a 24-hour moment on the site." />
            ) : (
                <div className="nd-grid nd-grid-3">
                    {stories.map((s, i) => (
                        <article key={s.id} className="nd-card nd-card-pad">
                            <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', aspectRatio: '9 / 16', marginBottom: 'var(--sp-4)', background: 'var(--paper-deep)' }}>
                                {s.mediaType === 'video'
                                    ? <video src={mediaSrc(s.mediaUrl)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <img src={mediaSrc(s.mediaUrl)} alt={`Story ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                <span className="nd-chip is-count" style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(10,10,10,0.85)' }}>
                                    {s.mediaType.toUpperCase()}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <div>
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                        <span className="nd-chip is-steel" style={{ textTransform: 'none' }}>{s.viewCount} views</span>
                                        <span className="nd-chip is-steel" style={{ textTransform: 'none' }}>{s.clickCount} clicks</span>
                                    </div>
                                    <div className="nd-faint" style={{ fontSize: 'var(--step-caption)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                        <span className="nd-avatar" style={{ width: 20, height: 20, fontSize: 9 }}>
                                            {initials(s.admin?.firstName, s.admin?.lastName)}
                                        </span>
                                        Added {timeAgo(s.createdAt)} · expires {timeAgo(s.expiresAt)}
                                    </div>
                                </div>
                                <button className="nd-btn-icon danger" onClick={() => confirm({ node: s, label: `${s.mediaType} story` })} aria-label="Delete story">
                                    <span style={{ fontSize: 15 }}>✕</span>
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <Modal open={open} onClose={() => !pendingFiles.some(p => p.uploading) && setOpen(false)} title="New stories">
                <p className="nd-hint" style={{ margin: '0 0 var(--sp-5)' }}>
                    Each upload becomes a story, expiring 24 hours after publishing. Multiple files form one bundle.
                </p>
                {(pendingFiles.length === 0) && (
                    <div className="nd-empty" style={{ padding: 24 }}>
                        <p style={{ margin: 0 }}>Pick an image or video to begin.</p>
                        <label className="nd-btn nd-btn-secondary nd-btn-sm" style={{ cursor: 'pointer' }}>
                            <AutoAwesomeRoundedIcon style={{ fontSize: 15 }} /> Choose media
                            <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
                        </label>
                    </div>
                )}
                <div className="nd-stack">
                    {pendingFiles.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', padding: 10 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--paper-deep)', flexShrink: 0 }}>
                                {p.url && (p.mediaType === 'video'
                                    ? <video src={mediaSrc(p.url)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <img src={mediaSrc(p.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="nd-table-strong" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.file.name}</div>
                                <div className="nd-faint nd-mono" style={{ fontSize: 11 }}>{p.mediaType.toUpperCase()}</div>
                                {p.uploading && <div className="nd-hint">Uploading…</div>}
                                {!p.uploading && !p.url && (
                                    <button className="nd-btn nd-btn-secondary nd-btn-sm" onClick={() => uploadOne(i)}>Upload</button>
                                )}
                            </div>
                            <button className="nd-btn-icon danger" onClick={() => removePending(i)} aria-label="Remove"><span style={{ fontSize: 15 }}>✕</span></button>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--sp-5)' }}>
                    <button className="nd-btn nd-btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                    <button className="nd-btn nd-btn-primary" onClick={publish} disabled={!pendingFiles.some(p => p.url)}>
                        Publish {pendingFiles.filter(p => p.url).length} story{pendingFiles.filter(p => p.url).length === 1 ? '' : 's'}
                    </button>
                </div>
            </Modal>

            {dialog}
        </div>
    );
};

export default StoryManagementPage;