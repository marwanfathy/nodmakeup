import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { productApi, brandApi, categoryApi, collectionApi, discountApi, mediaApi } from '../api/adminApi';
import { errMsg, slugify, parseDecimal } from '../utils/format';
import { Panel, Field, Input, Textarea, Select, Switch, Loading, ErrorBox, UploadTile } from '../common/UI';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';

const ReactColorInput = ({ value, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 36, padding: 0, border: '1px solid var(--hairline-strong)', borderRadius: 'var(--r-sm)', background: 'transparent', cursor: 'pointer' }} />
        {value && <span className="nd-swatch" style={{ background: value }} />}
    </div>
);

const VariantEditor = ({ variant, index, onUpdate, onRemove }) => {
    const [uploadingIdx, setUploadingIdx] = useState(null);

    const set = (key, val) => onUpdate(index, { ...variant, [key]: val });

    const uploadImage = async (file, imgIdx) => {
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        setUploadingIdx(imgIdx);
        const images = variant.images ? [...variant.images] : [];
        if (imgIdx === -1) {
            images.push({ imageUrl: '', altText: '', displayOrder: images.length, _previewUrl: objectUrl });
        } else {
            images[imgIdx] = { ...(images[imgIdx] || {}), _previewUrl: objectUrl };
        }
        onUpdate(index, { ...variant, images });
        try {
            const res = await mediaApi.uploadProductImage(file);
            const next = variant.images ? [...variant.images] : [];
            if (imgIdx === -1) {
                next.push({ imageUrl: res.url, altText: '', displayOrder: next.length });
            } else {
                next[imgIdx] = { ...(next[imgIdx] || {}), imageUrl: res.url, _previewUrl: undefined };
            }
            onUpdate(index, { ...variant, images: next });
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        } catch (err) {
            const rolled = variant.images ? [...variant.images] : [];
            rolled[imgIdx] = { ...(rolled[imgIdx] || {}), _previewUrl: undefined };
            onUpdate(index, { ...variant, images: rolled });
            toast.error(errMsg(err, 'Image upload failed.'));
        } finally {
            setUploadingIdx(null);
        }
    };

    const removeImage = (imgIdx) => {
        const images = variant.images.filter((_, i) => i !== imgIdx);
        onUpdate(index, { ...variant, images });
    };

    return (
        <div style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', background: 'var(--paper)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
                <span className="nd-eyebrow" style={{ color: 'var(--gold-deep)' }}>Variant {String(index + 1).padStart(2, '0')}</span>
                <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => onRemove(index)}>
                    <DeleteOutlineRoundedIcon style={{ fontSize: 16 }} /> Remove
                </button>
            </div>

            <div className="nd-field-row">
                <Field label="SKU" required>
                    <Input value={variant.sku || ''} onChange={(e) => set('sku', e.target.value)} placeholder="NOD-LP-001" className="nd-mono" />
                </Field>
                <Field label="Price (EGP)" required>
                    <Input type="number" min="0" step="0.01" value={variant.price ?? ''} onChange={(e) => set('price', e.target.value)} />
                </Field>
                <Field label="Stock" required>
                    <Input type="number" min="0" step="1" value={variant.stockQuantity ?? ''} onChange={(e) => set('stockQuantity', e.target.value)} />
                </Field>
            </div>

            <div className="nd-field-row">
                <Field label="Shade / colour">
                    <Input value={variant.colorName || ''} onChange={(e) => set('colorName', e.target.value)} placeholder="e.g. Rouge Velour" />
                </Field>
                <Field label="Size">
                    <Input value={variant.size || ''} onChange={(e) => set('size', e.target.value)} placeholder="e.g. 4.2 g" />
                </Field>
                <Field label="Hex swatch">
                    <ReactColorInput value={variant.hexCode || ''} onChange={(v) => set('hexCode', v)} />
                </Field>
            </div>

            <Field label="Images">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {(variant.images || []).map((img, imgIdx) => (
                        <UploadTile
                            key={imgIdx}
                            src={img.imageUrl || img._previewUrl}
                            busy={uploadingIdx === imgIdx}
                            onRemove={() => removeImage(imgIdx)}
                            onFile={(file) => uploadImage(file, imgIdx)}
                            label="variant image"
                        />
                    ))}
                    <UploadTile busy={uploadingIdx === -1} onFile={(file) => uploadImage(file, -1)} label="Add image" />
                </div>
            </Field>
        </div>
    );
};

const ProductFormPage = () => {
    const { productId } = useParams();
    const isEdit = Boolean(productId);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '', slug: '', shortDescription: '', description: '',
        categoryId: '', brandId: '', discountId: '', isActive: false, isHero: false,
        variants: [], collectionIds: [],
    });
    const [refs, setRefs] = useState({ categories: [], brands: [], collections: [], discounts: [] });

    useEffect(() => {
        let active = true;
        (async () => {
            const [categories, brands, collections, discounts] = await Promise.all([
                categoryApi.getAll().catch(() => []),
                brandApi.getAll().catch(() => []),
                collectionApi.getAll().catch(() => []),
                discountApi.getAll().catch(() => []),
            ]);
            setRefs({ categories, brands, collections, discounts });

            if (isEdit) {
                try {
                    const p = await productApi.getById(productId);
                    if (!active) return;
                    setForm({
                        name: p.name, slug: p.slug,
                        shortDescription: p.shortDescription || '',
                        description: p.description || '',
                        categoryId: p.categoryId || '', brandId: p.brandId || '',
                        discountId: p.discountId || '',
                        isActive: p.isActive, isHero: p.isHero,
                        variants: (p.variants || []).map(v => ({
                            id: v.id, sku: v.sku, price: String(v.price), stockQuantity: String(v.stockQuantity),
                            colorName: v.colorName || '', size: v.size || '', hexCode: v.hexCode || '',
                            images: (v.images || []).filter(img => img.imageUrl).map(img => ({ imageUrl: img.imageUrl, altText: img.altText || '', displayOrder: img.displayOrder || 0, _new: false })),
                        })),
                        collectionIds: (p.collections || []).map(c => c.collection?.id || c.collectionId).filter(Boolean),
                    });
                } catch (err) {
                    setError(errMsg(err, 'Failed to load product.'));
                }
            }
            if (active) setLoading(false);
        })();
        return () => { active = false; };
    }, [productId, isEdit]);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const setName = (name) => {
        const slug = form.slug || slugify(name);
        setForm(f => ({ ...f, name, slug }));
    };

    const updateVariant = (idx, variant) => {
        const variants = [...form.variants];
        variants[idx] = variant;
        set('variants', variants);
    };
    const removeVariant = (idx) => set('variants', form.variants.filter((_, i) => i !== idx));

    const addVariant = () => {
        set('variants', [...form.variants, {
            sku: '', price: '', stockQuantity: '', colorName: '', size: '', hexCode: '', images: [],
        }]);
    };

    const toggleCollection = (id) => {
        const has = form.collectionIds.includes(id);
        set('collectionIds', has ? form.collectionIds.filter(c => c !== id) : [...form.collectionIds, id]);
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (!form.name.trim()) {
                toast.error('Product name is required.'); setSaving(false); return;
            }
            if (!form.categoryId || !form.brandId) {
                toast.error('Category and brand are required.'); setSaving(false); return;
            }
            const cleanVariants = form.variants.map(v => ({
                id: v.id,
                sku: v.sku.trim(), price: parseDecimal(v.price), stockQuantity: Math.max(0, parseInt(v.stockQuantity || 0, 10)),
                colorName: v.colorName?.trim() || null, size: v.size?.trim() || null, hexCode: v.hexCode || null,
                images: (v.images || []).filter(img => img.imageUrl).map((img, i) => ({
                    imageUrl: img.imageUrl, altText: img.altText || null, displayOrder: img.displayOrder ?? i,
                })),
            }));
            if (cleanVariants.length === 0) {
                toast.error('Add at least one variant with a SKU.'); setSaving(false); return;
            }
            const body = {
                name: form.name.trim(),
                slug: form.slug.trim() || slugify(form.name),
                shortDescription: form.shortDescription?.trim() || null,
                description: form.description?.trim() || null,
                categoryId: form.categoryId,
                brandId: form.brandId,
                discountId: form.discountId || null,
                isActive: form.isActive,
                isHero: form.isHero,
                variants: cleanVariants,
                collectionIds: form.collectionIds,
            };
            if (isEdit) await productApi.update(productId, body);
            else await productApi.create(body);
            toast.success(`Product ${isEdit ? 'updated' : 'created'}.`);
            navigate('/admin/products');
        } catch (err) {
            toast.error(errMsg(err, 'Save failed.'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loading label="Opening the atelier…" />;
    if (error) return <ErrorBox message={error} onRetry={() => navigate('/admin/products')} />;

    return (
        <form onSubmit={onSubmit} noValidate>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Catalog · Products</div>
                    <h1 className="nd-page-title">{isEdit ? 'Edit product' : 'New product'}</h1>
                    <div className="nd-topbar-sub">/{form.slug || 'slug'}</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="nd-btn nd-btn-secondary" onClick={() => navigate('/admin/products')}>
                        <ArrowBackRoundedIcon style={{ fontSize: 17 }} /> Back
                    </button>
                    <button type="submit" className="nd-btn nd-btn-primary" disabled={saving}>
                        <SaveRoundedIcon style={{ fontSize: 17 }} /> {saving ? 'Saving…' : 'Save product'}
                    </button>
                </div>
            </div>

            <Panel title="Identity" sub="Name, urls and the opening description.">
                <div className="nd-field-row">
                    <Field label="Product name" required>
                        <Input value={form.name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Silk Matte Lipstick" invalid={!form.name.trim()} />
                    </Field>
                    <Field label="Slug" required>
                        <Input value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder="silk-matte-lipstick" className="nd-mono" invalid={!form.slug.trim()} />
                    </Field>
                </div>
                <Field label="Short description">
                    <Input value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="One line for cards and rails." />
                </Field>
                <Field label="Description">
                    <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="The full story of the product." />
                </Field>
            </Panel>

            <Panel title="Placement" sub="Where the product sits in the catalogue.">
                <div className="nd-field-row">
                    <Field label="Category" required>
                        <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} invalid={!form.categoryId}>
                            <option value="">Select a category…</option>
                            {refs.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Brand" required>
                        <Select value={form.brandId} onChange={(e) => set('brandId', e.target.value)} invalid={!form.brandId}>
                            <option value="">Select a brand…</option>
                            {refs.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Discount code" hint="Optional bonded discount.">
                        <Select value={form.discountId} onChange={(e) => set('discountId', e.target.value)}>
                            <option value="">None</option>
                            {refs.discounts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.couponCode || 'no code'})</option>)}
                        </Select>
                    </Field>
                </div>
                <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}>
                    <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Available for sale" />
                    <Switch checked={form.isHero} onChange={(v) => set('isHero', v)} label="Featured on hero rail" />
                </div>
                <hr className="nd-rule" />
                <Field label="Collections" hint="Your editorial edits this product belongs to.">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {refs.collections.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleCollection(c.id)}
                                className={`nd-chip ${form.collectionIds.includes(c.id) ? 'is-live' : 'is-off'}`}
                                style={{ cursor: 'pointer', border: 'none' }}
                            >
                                {form.collectionIds.includes(c.id) && '✓ '}{c.name}
                            </button>
                        ))}
                        {refs.collections.length === 0 && <span className="nd-hint">No collections yet.</span>}
                    </div>
                </Field>
            </Panel>

            <Panel
                title="Variants"
                sub="Each shade or size, its price, its stock, its imagery."
                actions={
                    <button type="button" className="nd-btn nd-btn-secondary nd-btn-sm" onClick={addVariant}>
                        <AddRoundedIcon style={{ fontSize: 16 }} /> Add variant
                    </button>
                }
            >
                <div className="nd-stack">
                    {form.variants.map((v, i) => (
                        <VariantEditor key={v.id || `v-${i}`} variant={v} index={i} onUpdate={updateVariant} onRemove={removeVariant} />
                    ))}
                    {form.variants.length === 0 && (
                        <div className="nd-empty" style={{ padding: 32 }}>
                            <p style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>No variants yet.</p>
                            <button type="button" className="nd-btn nd-btn-secondary nd-btn-sm" onClick={addVariant}>
                                <AddRoundedIcon style={{ fontSize: 16 }} /> Add the first variant
                            </button>
                        </div>
                    )}
                </div>
            </Panel>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 'var(--sp-6)' }}>
                <button type="button" className="nd-btn nd-btn-secondary" onClick={() => navigate('/admin/products')}>Cancel</button>
                <button type="submit" className="nd-btn nd-btn-primary" disabled={saving}>
                    <SaveRoundedIcon style={{ fontSize: 17 }} /> {saving ? 'Saving…' : 'Save product'}
                </button>
            </div>
        </form>
    );
};

export default ProductFormPage;