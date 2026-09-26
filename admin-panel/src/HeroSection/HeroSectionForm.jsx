import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { heroSectionApi, mediaApi } from '../api/adminApi';
import { errMsg, slugify, mediaSrc } from '../utils/format';
import { Panel, Field, Input, Textarea, Switch, Loading, ErrorBox, UploadTile } from '../common/UI';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

const LAYOUT_OPTIONS = [
    { value: 'BACKGROUND_FULL', label: 'Backdrop' },
    { value: 'FOREGROUND_LEFT', label: 'Left' },
    { value: 'FOREGROUND_RIGHT', label: 'Right' },
    { value: 'FOREGROUND_CENTER', label: 'Center' },
];

const emptySlide = () => ({ title: '', subtitle: '', linkUrl: '', thumbnailUrl: '', mediaItems: [] });
const emptyMedia = () => ({ mediaUrl: '', mediaType: 'IMAGE', altText: '', layoutStyle: 'BACKGROUND_FULL' });

const SlideEditor = ({ slide, index, onUpdate, onRemove, onMove, first, last }) => {
    const set = (key, val) => onUpdate(index, { ...slide, [key]: val });

    const uploadThumb = async (file) => {
        if (!file) return;
        try {
            const res = await mediaApi.uploadHeroMedia(file);
            set('thumbnailUrl', res.url);
        } catch (err) {
            toast.error(errMsg(err, 'Thumbnail upload failed.'));
        }
    };

    const updateMedia = (midx, patch) => {
        const mediaItems = slide.mediaItems.map((m, i) => i === midx ? { ...m, ...patch } : m);
        onUpdate(index, { ...slide, mediaItems });
    };

    const uploadMedia = async (file, midx) => {
        if (!file) return;
        try {
            const res = await mediaApi.uploadHeroMedia(file);
            const isVideo = file.type.startsWith('video');
            updateMedia(midx, { mediaUrl: res.url, mediaType: isVideo ? 'VIDEO' : 'IMAGE' });
        } catch (err) {
            toast.error(errMsg(err, 'Media upload failed.'));
        }
    };

    const addMedia = () => onUpdate(index, { ...slide, mediaItems: [...slide.mediaItems, { ...emptyMedia() }] });
    const removeMedia = (midx) => onUpdate(index, { ...slide, mediaItems: slide.mediaItems.filter((_, i) => i !== midx) });

    return (
        <div style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', background: 'var(--paper)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button className="nd-btn-icon" onClick={() => onMove(index, -1)} disabled={first} aria-label="Move up"><KeyboardArrowUpRoundedIcon style={{ fontSize: 18 }} /></button>
                    <button className="nd-btn-icon" onClick={() => onMove(index, 1)} disabled={last} aria-label="Move down"><KeyboardArrowDownRoundedIcon style={{ fontSize: 18 }} /></button>
                </div>
                <span className="nd-eyebrow" style={{ color: 'var(--gold-deep)' }}>Slide {String(index + 1).padStart(2, '0')}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="nd-chip is-count">{slide.mediaItems.length} layer{slide.mediaItems.length === 1 ? '' : 's'}</span>
                    <button className="nd-btn-icon danger" onClick={() => onRemove(index)} aria-label="Remove slide"><DeleteOutlineRoundedIcon style={{ fontSize: 17 }} /></button>
                </span>
            </div>

            <div style={{ padding: 'var(--sp-5)' }}>
                <div className="nd-field-row">
                    <Field label="Headline" required>
                        <Input value={slide.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. The Holiday Glow Edit" invalid={!slide.title.trim()} />
                    </Field>
                    <Field label="Subtitle">
                        <Input value={slide.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Supporting line" />
                    </Field>
                    <Field label="Link URL" required>
                        <Input className="nd-mono" value={slide.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="/holiday-glow-edit" invalid={!slide.linkUrl.trim()} />
                    </Field>
                </div>

                <Field label="Storyboard thumbnail">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {slide.thumbnailUrl && (
                            <img src={mediaSrc(slide.thumbnailUrl)} alt="thumbnail" style={{ width: 96, height: 56, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)' }} />
                        )}
                        <UploadTile src={null} onFile={uploadThumb} label="Thumbnail" />
                    </div>
                </Field>

                <hr className="nd-rule" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
                    <span className="nd-label" style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Media layers</span>
                    <button type="button" className="nd-btn nd-btn-secondary nd-btn-sm" onClick={addMedia}>
                        <AddRoundedIcon style={{ fontSize: 15 }} /> Add layer
                    </button>
                </div>

                {slide.mediaItems.length === 0 ? (
                    <div className="nd-empty" style={{ padding: 24 }}>
                        <p style={{ margin: 0, fontWeight: 600 }}>No media on this slide.</p>
                        <p style={{ margin: 0, fontSize: 'var(--step-sm)', color: 'var(--ink-faint)' }}>Add a backdrop image or a foreground product shot.</p>
                    </div>
                ) : (
                    <div className="nd-stack">
                        {slide.mediaItems.map((m, midx) => (
                            <div key={midx} style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', padding: 10, background: 'var(--paper-raised)', flexWrap: 'wrap' }}>
                                <div style={{ width: 88, height: 54, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--paper-deep)', flexShrink: 0, position: 'relative' }}>
                                    {m.mediaUrl && (m.mediaType === 'VIDEO'
                                        ? <video src={mediaSrc(m.mediaUrl)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <img src={mediaSrc(m.mediaUrl)} alt={m.altText} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                                    {m.mediaUrl && <span className="nd-chip is-count" style={{ position: 'absolute', bottom: 3, right: 3, fontSize: 9, padding: '1px 6px' }}>{m.mediaType === 'VIDEO' ? 'VIDEO' : 'IMG'}</span>}
                                    <UploadTile src={null} onFile={(f) => uploadMedia(f, midx)} label="media" />
                                </div>
                                <Input
                                    value={m.altText}
                                    onChange={(e) => updateMedia(midx, { altText: e.target.value })}
                                    placeholder="Alt text for this layer…"
                                    style={{ flex: 1, minWidth: 140 }}
                                />
                                <SegmentedControl value={m.layoutStyle} onChange={(v) => updateMedia(midx, { layoutStyle: v })} />
                                <button className="nd-btn-icon danger" onClick={() => removeMedia(midx)} aria-label="Remove layer">
                                    <DeleteOutlineRoundedIcon style={{ fontSize: 17 }} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const SegmentedControl = ({ value, onChange }) => (
    <div className="nd-segmented">
        {LAYOUT_OPTIONS.map(opt => (
            <button key={opt.value} type="button" className={value === opt.value ? 'active' : ''} onClick={() => onChange(opt.value)}>
                {opt.label}
            </button>
        ))}
    </div>
);

const HeroSectionForm = () => {
    const { heroSectionId } = useParams();
    const isEdit = Boolean(heroSectionId);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(!!isEdit);
    const [error, setError] = useState(null);
    const [form, setForm] = useState({ title: '', description: '', slug: '', isActive: false, slides: [] });

    useEffect(() => {
        if (!isEdit) return;
        let active = true;
        heroSectionApi.getById(heroSectionId)
            .then(res => active && setForm(res))
            .catch(err => active && setError(errMsg(err, 'Failed to load hero section.')))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [heroSectionId, isEdit]);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
    const setTitle = (title) => setForm(f => ({ ...f, title, slug: f.slug || slugify(title) }));

    const updateSlide = (idx, slide) => {
        const slides = [...form.slides];
        slides[idx] = slide;
        set('slides', slides);
    };
    const removeSlide = (idx) => set('slides', form.slides.filter((_, i) => i !== idx));
    const addSlide = () => set('slides', [...form.slides, emptySlide()]);
    const moveSlide = (idx, dir) => {
        const slides = [...form.slides];
        const target = idx + dir;
        if (target < 0 || target >= slides.length) return;
        [slides[idx], slides[target]] = [slides[target], slides[idx]];
        set('slides', slides);
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!form.title.trim() || !form.slug.trim()) {
                toast.error('Title and slug are required.'); return;
            }
            const cleanSlides = form.slides.map((s, i) => ({
                title: s.title?.trim() || '',
                subtitle: s.subtitle?.trim() || null,
                linkUrl: s.linkUrl?.trim() || '',
                thumbnailUrl: s.thumbnailUrl || '',
                displayOrder: i,
                mediaItems: (s.mediaItems || []).map((m, mi) => ({
                    mediaUrl: m.mediaUrl, mediaType: m.mediaType,
                    altText: m.altText?.trim() || null, layoutStyle: m.layoutStyle,
                    displayOrder: mi,
                })).filter(m => m.mediaUrl),
            }));
            if (!cleanSlides.length) {
                toast.error('Add at least one slide.'); return;
            }
            if (cleanSlides.some(s => !s.title.trim() || !s.linkUrl.trim())) {
                toast.error('Every slide needs a headline and a link URL.'); return;
            }
            const body = {
                title: form.title.trim(),
                description: form.description?.trim() || null,
                slug: form.slug.trim(),
                isActive: form.isActive,
                slides: cleanSlides,
            };
            if (isEdit) await heroSectionApi.update(heroSectionId, body);
            else await heroSectionApi.create(body);
            toast.success(`Hero section ${isEdit ? 'saved' : 'created'}.`);
            navigate('/admin/hero-sections');
        } catch (err) {
            toast.error(errMsg(err, 'Save failed.'));
        }
    };

    if (loading) return <Loading label="Opening the campaign…" />;
    if (error) return <ErrorBox message={error} onRetry={() => navigate('/admin/hero-sections')} />;

    return (
        <form onSubmit={onSubmit} noValidate>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Content · Hero Sections</div>
                    <h1 className="nd-page-title">{isEdit ? 'Edit campaign' : 'New campaign'}</h1>
                    <div className="nd-topbar-sub">/{form.slug || 'slug'}</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="nd-btn nd-btn-secondary" onClick={() => navigate('/admin/hero-sections')}>
                        <ArrowBackRoundedIcon style={{ fontSize: 17 }} /> Back
                    </button>
                    <button type="submit" className="nd-btn nd-btn-primary">
                        <SaveRoundedIcon style={{ fontSize: 17 }} /> Save section
                    </button>
                </div>
            </div>

            <Panel title="Identity" sub="The campaign name and public url.">
                <div className="nd-field-row">
                    <Field label="Title" required>
                        <Input value={form.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Holiday Glow Edit" invalid={!form.title.trim()} />
                    </Field>
                    <Field label="Slug" required>
                        <Input className="nd-mono" value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder="holiday-glow-edit" invalid={!form.slug.trim()} />
                    </Field>
                </div>
                <Field label="Description">
                    <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this campaign about?" />
                </Field>
                <div className="nd-switch-row">
                    <span style={{ fontSize: 'var(--step-sm)', fontWeight: 600 }}>Live on the site</span>
                    <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} />
                </div>
            </Panel>

            <Panel
                title="Slides"
                sub="Play in order. Each slide carries headwords and media layers."
                actions={
                    <button type="button" className="nd-btn nd-btn-secondary nd-btn-sm" onClick={addSlide}>
                        <AddRoundedIcon style={{ fontSize: 16 }} /> Add slide
                    </button>
                }
            >
                <div className="nd-stack">
                    {form.slides.map((slide, i) => (
                        <SlideEditor
                            key={i}
                            slide={slide}
                            index={i}
                            onUpdate={updateSlide}
                            onRemove={removeSlide}
                            onMove={moveSlide}
                            first={i === 0}
                            last={i === form.slides.length - 1}
                        />
                    ))}
                    {form.slides.length === 0 && (
                        <div className="nd-empty" style={{ padding: 32 }}>
                            <h3 style={{ margin: 0 }}>No slides yet</h3>
                            <p style={{ margin: 0 }}>Compose the first scene of the campaign.</p>
                            <button type="button" className="nd-btn nd-btn-secondary nd-btn-sm" onClick={addSlide}>
                                <AddRoundedIcon style={{ fontSize: 16 }} /> Add the first slide
                            </button>
                        </div>
                    )}
                </div>
            </Panel>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 'var(--sp-6)' }}>
                <button type="button" className="nd-btn nd-btn-secondary" onClick={() => navigate('/admin/hero-sections')}>Cancel</button>
                <button type="submit" className="nd-btn nd-btn-primary">
                    <SaveRoundedIcon style={{ fontSize: 17 }} /> Save section
                </button>
            </div>
        </form>
    );
};

export default HeroSectionForm;