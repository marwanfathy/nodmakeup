import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { landingBannerApi, mediaApi } from '../api/adminApi';
import { errMsg } from '../utils/format';
import { Panel, Field, Input, Switch, Loading, ErrorBox, UploadTile } from '../common/UI';

// The landing banner between Stories and the product hero. One slot, edited in
// place: the storefront reads the active row on the server and falls back to
// its built-in copy when there is none, so this page never has to create or
// delete anything — it just writes the slot.
//
// The English and Arabic columns are the same three strings side by side rather
// than a locale switcher, because the operator has to see both at once to know
// whether the Arabic page is still covered. An Arabic field left empty is not an
// error: the storefront falls back to the English value for that one string.

const EMPTY = {
    imageUrl: '',
    imageAlt: '',
    tagline: '',
    taglineAr: '',
    title: '',
    titleAr: '',
    ctaLabel: '',
    ctaLabelAr: '',
    ctaUrl: '/shop',
    isActive: true,
};

/**
 * Turn the backend's 400 body into per-field messages.
 *
 * middleware/validate answers { message: 'Validation failed.', details: ['ctaUrl: …'] }
 * and errMsg() only surfaces `message`, which on a ten-field form just says
 * something is wrong without saying what. Every field here is top-level, so the
 * detail's leading segment is the field name and can be matched directly.
 */
const fieldErrorsFrom = (err) => {
    const details = err?.response?.data?.details;
    if (!Array.isArray(details)) return {};
    return details.reduce((acc, line) => {
        const splitAt = String(line).indexOf(': ');
        if (splitAt > 0) acc[String(line).slice(0, splitAt)] = String(line).slice(splitAt + 2);
        return acc;
    }, {});
};

/**
 * Coerce a row from the API into the shape the form works with.
 *
 * The API hands back a nullable column as `null`, and a bare spread —
 * `{ ...EMPTY, ...row }` — lets that `null` overwrite the `''` default, because
 * spread copies own enumerable keys unconditionally. Every untranslated Arabic
 * twin and a banner with no alt text then arrive as `null`, so the first
 * `form.imageAlt.trim()` on save threw "Cannot read properties of null" and the
 * inputs rendered as uncontrolled. Spreading is not enough; the values have to
 * be normalised.
 *
 * Returns the EMPTY shape for a null row, which is also the "nothing saved yet"
 * case, so a first visit shows a blank form rather than an error.
 */
const toForm = (row) => {
    const src = row ?? {};
    // Anything that is not a string is a null/undefined column, never a number
    // or an object, so this stays a plain guard rather than a coercion.
    const str = (v) => (typeof v === 'string' ? v : '');
    return {
        ...EMPTY,
        imageUrl: str(src.imageUrl),
        imageAlt: str(src.imageAlt),
        tagline: str(src.tagline),
        taglineAr: str(src.taglineAr),
        title: str(src.title),
        titleAr: str(src.titleAr),
        ctaLabel: str(src.ctaLabel),
        ctaLabelAr: str(src.ctaLabelAr),
        // ctaUrl is NOT NULL in the schema, but default it anyway so the form
        // can never be submitted with an empty link.
        ctaUrl: str(src.ctaUrl) || EMPTY.ctaUrl,
        // Only an explicit false means off; null/undefined stays on.
        isActive: src.isActive !== false,
    };
};

const LandingBannerPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [form, setForm] = useState(EMPTY);
    // Null means "no row has ever been saved", which is what the header copy and
    // the dirty check both key off. Held in the same normalised shape as `form`
    // so the two can be compared with JSON.stringify.
    const [saved, setSaved] = useState(null);
    const [errors, setErrors] = useState({});
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        setError(null);
        landingBannerApi.get()
            .then((res) => {
                // data is null until the slot has been written once.
                const row = res?.data ?? null;
                const normalized = toForm(row);
                setSaved(row ? normalized : null);
                setForm(normalized);
            })
            .catch((err) => setError(errMsg(err, 'Failed to load the banner.')))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const onUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const res = await mediaApi.uploadBannerImage(file);
            set('imageUrl', res.url);
            toast.success('Banner image uploaded.');
        } catch (err) {
            toast.error(errMsg(err, 'Image upload failed.'));
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            // Trim here as well as in the schema: it keeps the saved row equal to
            // what the operator can see in the inputs after a save.
            const body = {
                ...form,
                imageAlt: form.imageAlt.trim(),
                tagline: form.tagline.trim(),
                taglineAr: form.taglineAr.trim(),
                title: form.title.trim(),
                titleAr: form.titleAr.trim(),
                ctaLabel: form.ctaLabel.trim(),
                ctaLabelAr: form.ctaLabelAr.trim(),
                ctaUrl: form.ctaUrl.trim(),
            };
            const res = await landingBannerApi.save(body);
            // The saved row comes back from the server, so it carries the same
            // nullable columns and needs normalising again. Reading it back (as
            // opposed to trusting the local `body`) is what keeps `saved` honest
            // about what is actually in the database.
            const normalized = toForm(res?.data ?? null);
            setSaved(normalized);
            setForm(normalized);
            toast.success('Banner saved. The storefront picks it up within a minute.');
        } catch (err) {
            const fieldErrors = fieldErrorsFrom(err);
            setErrors(fieldErrors);
            toast.error(
                Object.keys(fieldErrors).length
                    ? `Check the highlighted ${Object.keys(fieldErrors).length === 1 ? 'field' : 'fields'}.`
                    : errMsg(err, 'Save failed.'),
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loading label="Opening the banner…" />;
    if (error) return <ErrorBox message={error} onRetry={load} />;

    // `saved` is already normalised by toForm, so it can be compared with `form`
    // directly. Merging EMPTY over it here — as this used to — compared a
    // normalised shape against a raw one, so the two never matched and Discard
    // was pinned on permanently.
    const dirty = JSON.stringify(form) !== JSON.stringify(saved ?? EMPTY);

    return (
        <form onSubmit={onSubmit} noValidate>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Content · Landing banner</div>
                    <h1 className="nd-page-title">Homepage banner</h1>
                    <div className="nd-topbar-sub">
                        {saved ? (saved.isActive ? 'Live on the homepage' : 'Switched off') : 'Never saved — the storefront is showing its built-in copy'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {dirty && (
                        <button type="button" className="nd-btn nd-btn-secondary" onClick={load} disabled={saving}>
                            <RestartAltRoundedIcon style={{ fontSize: 17 }} /> Discard
                        </button>
                    )}
                    <button type="submit" className="nd-btn nd-btn-primary" disabled={saving}>
                        <SaveRoundedIcon style={{ fontSize: 17 }} /> {saving ? 'Saving…' : 'Save banner'}
                    </button>
                </div>
            </div>

            <div className="nd-stack">
                <Panel title="Image" sub="A wide photo, ideally 4:3 or wider. It is cropped to fill the banner.">
                    <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <Field
                            label="Banner photo"
                            required
                            error={errors.imageUrl}
                            hint="JPEG, PNG, GIF or WebP up to 10 MB."
                        >
                            {/* The shared upload tile is a fixed 92px square, which is
                                useless for judging a wide crop — `is-wide` renders the
                                photo at banner proportions so the operator can see what
                                the storefront's object-fit: cover will actually show. */}
                            <UploadTile
                                src={form.imageUrl}
                                busy={uploading}
                                onFile={onUpload}
                                label="banner photo"
                                className="is-wide"
                            />
                        </Field>
                        <Field
                            label="Alt text"
                            error={errors.imageAlt}
                            hint="Describes the photo for screen readers. Leave empty to skip."
                            style={{ flex: 1, minWidth: 220 }}
                        >
                            <Input
                                value={form.imageAlt}
                                onChange={(e) => set('imageAlt', e.target.value)}
                                placeholder="e.g. Two lipsticks on a marble surface"
                            />
                        </Field>
                    </div>
                </Panel>

                <div className="nd-grid nd-grid-2">
                    <Panel title="English" sub="Shown on /en.">
                        <div className="nd-stack">
                            <Field label="Tagline" required error={errors.tagline}>
                                <Input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="The lineup is here" />
                            </Field>
                            <Field label="Title" required error={errors.title}>
                                <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="NOD x the night" />
                            </Field>
                            <Field label="Button label" required error={errors.ctaLabel}>
                                <Input value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Shop the collection" />
                            </Field>
                        </div>
                    </Panel>

                    <Panel title="العربية" sub="Shown on /ar. Leave a field empty to fall back to its English value.">
                        <div className="nd-stack" dir="rtl">
                            <Field label="Tagline" error={errors.taglineAr}>
                                <Input value={form.taglineAr} onChange={(e) => set('taglineAr', e.target.value)} placeholder="التشكيلة وصلت" />
                            </Field>
                            <Field label="Title" error={errors.titleAr}>
                                <Input value={form.titleAr} onChange={(e) => set('titleAr', e.target.value)} placeholder="نود × الليلة" />
                            </Field>
                            <Field label="Button label" error={errors.ctaLabelAr}>
                                <Input value={form.ctaLabelAr} onChange={(e) => set('ctaLabelAr', e.target.value)} placeholder="تسوقي المجموعة" />
                            </Field>
                        </div>
                    </Panel>
                </div>

                <Panel title="Button link" sub="Where the call to action goes.">
                    <Field
                        label="Site path"
                        required
                        error={errors.ctaUrl}
                        hint="A path on this site, starting with / — e.g. /shop or /product/some-slug. The /en or /ar prefix is added for you."
                        style={{ maxWidth: 420 }}
                    >
                        <Input value={form.ctaUrl} onChange={(e) => set('ctaUrl', e.target.value)} placeholder="/shop" />
                    </Field>
                </Panel>

                <Panel title="Visibility">
                    <Switch
                        checked={form.isActive}
                        onChange={(v) => set('isActive', v)}
                        label="Show this banner on the homepage"
                    />
                    <p className="nd-hint" style={{ margin: '10px 0 0' }}>
                        {/* Worth stating plainly: switching off does not blank the slot,
                            it sends the storefront back to its built-in campaign. An
                            operator expecting an empty homepage would be surprised. */}
                        Turning this off does not leave the homepage empty — the storefront falls back to
                        the campaign it ships with.
                    </p>
                </Panel>
            </div>
        </form>
    );
};

export default LandingBannerPage;
