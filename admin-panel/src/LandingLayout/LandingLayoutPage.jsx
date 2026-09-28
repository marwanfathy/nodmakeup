import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import { landingLayoutApi } from '../api/adminApi';
import { errMsg } from '../utils/format';
import { PageHead, Panel, Segmented, Switch, Loading, ErrorBox, Field, Input } from '../common/UI';
import { LANDING_SECTIONS } from '@nod/shared/dist/landing/sections';

/**
 * The homepage layout: which sections render, in what order.
 *
 * The row list here is the whole control surface. A section's position only means
 * something relative to the others, so this is a single ordered list rather than
 * a per-section form with a "position" field — and it is saved whole, because a
 * partial save would leave the operator unable to tell what is live.
 *
 * Nothing on this page is created or deleted. The list of sections is registered
 * in code (shared/src/landing/sections.ts) and this page builds its rows from
 * whatever the API returns, which already includes every registered section
 * whether or not it has a saved row. Adding a component to the homepage is
 * therefore a code change, not a GUI one — the row, its label and its switch
 * appear here on their own.
 */

// The fields that make up a saved layout. Compared to decide whether Save is worth
// offering, so a re-render or a re-order that lands back where it started does not
// leave a permanently enabled button.
const LAYOUT_FIELDS = ['key', 'isEnabled', 'heroMode', 'heroSlug'];

const sameLayout = (a, b) =>
    a.length === b.length &&
    a.every((row, index) => LAYOUT_FIELDS.every((field) => row[field] === b[index][field]));

/**
 * Moves `from` to `to` without mutating.
 *
 * `list` is a prop-sized array held in state, and React state updates must not
 * mutate what they were handed — a splice in place would edit the previous state
 * and the change would not re-render.
 */
const moved = (list, from, to) => {
    const next = [...list];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    return next;
};

/** The API's section rows, split into the ones the storefront can render and the leftovers. */
const partition = (rows) => ({
    live: rows.filter((row) => row.isRegistered),
    orphans: rows.filter((row) => !row.isRegistered),
});

/**
 * The mode choices for a section, read from the registry.
 *
 * Taken from the code registry rather than the API response so that a mode added
 * to a section shows up here with no backend or admin change. The backend still
 * validates against the same list, so the two cannot disagree about what is
 * offered.
 */
const modesFor = (key) => LANDING_SECTIONS.find((section) => section.key === key)?.modes ?? [];

/** Turns a mode id into a label, since the registry stores ids and not copy. */
const MODE_LABELS = {
    products: 'Products',
    slides: 'Slides carousel',
};

const LandingLayoutPage = () => {
    const [rows, setRows] = useState([]);
    const [saved, setSaved] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    // Key of the row currently held, or null when nothing is being dragged. Held
    // as a ref as well as state: the pointer-move handler needs it synchronously,
    // before React has re-rendered with the new order.
    const [dragKey, setDragKey] = useState(null);
    const dragKeyRef = useRef(null);

    // Live DOM nodes for the draggable rows, in render order. The drag works out
    // its target from their midpoints, so this has to track the real elements
    // rather than the array indices.
    const rowRefs = useRef([]);

    useEffect(() => {
        let cancelled = false;

        landingLayoutApi
            .get()
            .then((res) => {
                if (cancelled) return;
                const loaded = res.data ?? [];
                setRows(loaded);
                // The reply is also the baseline for the dirty check. Storing the
                // same array in both is what makes a re-order that lands back on
                // the saved order read as unchanged.
                setSaved(loaded);
            })
            .catch((err) => {
                if (!cancelled) setError(errMsg(err));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const { live, orphans } = useMemo(() => partition(rows), [rows]);
    const dirty = !sameLayout(live, partition(saved).live);

    const patch = useCallback((key, changes) => {
        setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
    }, []);

    const onDragStart = (key) => (event) => {
        // The handle owns the gesture from here, so the browser must not also
        // scroll or select text while it is held. Without this a touch drag scrolls
        // the page instead of moving the row, and a mouse drag selects the row text.
        event.preventDefault();
        dragKeyRef.current = key;
        setDragKey(key);
        // Capture keeps every subsequent move coming to this handle even when the
        // pointer leaves it, which is what lets the target be worked out from
        // geometry rather than from whichever row happens to be hovered.
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    /**
     * The "magnetic" part: the held row swaps into the slot the pointer is over as
     * soon as the pointer passes that row's midpoint, so it snaps to a position
     * rather than trailing the cursor at a free-floating offset.
     *
     * Target is found by walking the rows and taking the first whose midpoint is
     * below the pointer. Only the held row moves; the rest reflow around it, which
     * is why there is no transform maths here to drift out of sync with the order
     * the list is actually showing.
     */
    const onDragMove = (event) => {
        const held = dragKeyRef.current;
        if (held === null) return;

        const pointerY = event.clientY;
        let target = null;

        for (let index = 0; index < rowRefs.current.length; index += 1) {
            const node = rowRefs.current[index];
            if (!node) continue;
            const box = node.getBoundingClientRect();
            if (pointerY < box.top + box.height / 2) {
                target = index;
                break;
            }
            target = index;
        }

        if (target === null) return;

        setRows((current) => {
            const from = current.findIndex((row) => row.key === held);
            if (from === -1 || from === target) return current;
            return moved(current, from, target);
        });
    };

    const endDrag = (event) => {
        event?.currentTarget?.releasePointerCapture?.(event.pointerId);
        dragKeyRef.current = null;
        setDragKey(null);
    };

    const onSave = async () => {
        setSaving(true);
        try {
            // Only registered sections are sent. A leftover row for a section that
            // is no longer in the registry is rejected by the write, and omitting
            // it is also what preserves it: the service upserts what it receives
            // and leaves everything else alone, so a section re-registered later
            // comes back with its saved position.
            const payload = rows
                .filter((row) => row.isRegistered)
                .map((row) => {
                    const modes = modesFor(row.key);
                    if (modes.length === 0) return { key: row.key, isEnabled: row.isEnabled };
                    return {
                        key: row.key,
                        isEnabled: row.isEnabled,
                        heroMode: row.heroMode,
                        heroSlug: row.heroSlug,
                    };
                });

            const res = await landingLayoutApi.save(payload);
            const savedRows = res.data ?? [];
            setRows(savedRows);
            setSaved(savedRows);
            toast.success('Layout saved — the homepage picks it up within a minute.');
        } catch (err) {
            toast.error(errMsg(err));
        } finally {
            setSaving(false);
        }
    };

    const onDiscard = () => {
        setRows(saved);
        toast.info('Changes discarded.');
    };

    if (loading) return <Loading />;
    if (error) return <ErrorBox>{error}</ErrorBox>;

    return (
        <>
            <PageHead
                title="Homepage layout"
                sub="The order sections appear on the homepage, and which ones are shown."
                actions={
                    <>
                        <button
                            type="button"
                            className="nd-btn nd-btn-secondary"
                            onClick={onDiscard}
                            disabled={!dirty || saving}
                        >
                            <RestartAltRoundedIcon fontSize="small" /> Discard
                        </button>
                        <button
                            type="button"
                            className="nd-btn nd-btn-primary"
                            onClick={onSave}
                            disabled={!dirty || saving}
                        >
                            <SaveRoundedIcon fontSize="small" /> {saving ? 'Saving…' : 'Save layout'}
                        </button>
                    </>
                }
            />

            <Panel
                title="Sections"
                sub="Drag a row by its handle to move it. Changes apply when you save."
            >
                <ul className="nd-sortable">
                    {live.map((row, index) => {
                        const modes = modesFor(row.key);
                        const isDragging = dragKey === row.key;

                        return (
                            <li
                                key={row.key}
                                ref={(node) => {
                                    rowRefs.current[index] = node;
                                }}
                                className={`nd-sortable-row${isDragging ? ' is-dragging' : ''}${
                                    row.isEnabled ? '' : ' is-off'
                                }`}
                            >
                                <button
                                    type="button"
                                    className="nd-sortable-handle"
                                    aria-label={`Reorder ${row.labelEn}`}
                                    onPointerDown={onDragStart(row.key)}
                                    onPointerMove={onDragMove}
                                    onPointerUp={endDrag}
                                    onPointerCancel={endDrag}
                                >
                                    <DragIndicatorRoundedIcon fontSize="small" />
                                </button>

                                <div className="nd-sortable-main">
                                    <div className="nd-sortable-title">
                                        {row.labelEn}
                                        {row.labelAr && row.labelAr !== row.labelEn && (
                                            <span className="nd-sortable-alt">{row.labelAr}</span>
                                        )}
                                    </div>
                                    <div className="nd-sortable-hint">{row.hintEn}</div>
                                </div>

                                {modes.length > 0 && (
                                    <div className="nd-sortable-modes">
                                        <Segmented
                                            options={modes.map((mode) => ({
                                                value: mode,
                                                label: MODE_LABELS[mode] ?? mode,
                                            }))}
                                            value={row.heroMode}
                                            onChange={(heroMode) => patch(row.key, { heroMode })}
                                        />
                                        {row.heroMode === 'slides' && (
                                            <Field
                                                label="Carousel"
                                                hint="Which hero section the carousel reads."
                                                style={{ marginTop: 10 }}
                                            >
                                                <Input
                                                    value={row.heroSlug ?? ''}
                                                    onChange={(e) => patch(row.key, { heroSlug: e.target.value })}
                                                    placeholder="home"
                                                />
                                            </Field>
                                        )}
                                    </div>
                                )}

                                <div className="nd-sortable-toggle">
                                    <Switch
                                        checked={row.isEnabled}
                                        onChange={(isEnabled) => patch(row.key, { isEnabled })}
                                        label={row.isEnabled ? 'Shown' : 'Hidden'}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </Panel>

            {orphans.length > 0 && (
                <Panel
                    title="Not on the homepage"
                    sub="Saved for sections that are no longer registered. The storefront ignores them; re-registering the section restores its position."
                >
                    <ul className="nd-sortable">
                        {orphans.map((row) => (
                            <li key={row.key} className="nd-sortable-row is-off">
                                <div className="nd-sortable-handle" aria-hidden="true" />
                                <div className="nd-sortable-main">
                                    <div className="nd-sortable-title">{row.labelEn}</div>
                                    <div className="nd-sortable-hint">{row.hintEn}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
        </>
    );
};

export default LandingLayoutPage;
