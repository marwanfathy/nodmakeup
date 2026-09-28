'use client';

/**
 * A searchable governorate picker.
 *
 * A native <select> cannot be typed into, and the list is long enough that
 * scrolling it is a nuisance on a phone. This is the combobox pattern instead:
 * a text box that filters, a list of what is left, and full keyboard support,
 * because a hand-rolled widget that only responds to a mouse is worse than the
 * control it replaced.
 *
 * The visible text box is only ever a filter. The value that gets submitted is
 * a zone's governorate, chosen from the list — never whatever was typed, so an
 * address that merely looks like a governorate cannot slip through as one.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ShippingZone } from '../../lib/shared/dist/api/types.js';
import { governorateLabel, type Locale } from '../../lib/i18n/governorates';
import { normalizePlaceName } from '../../lib/geolocation';

export interface GovernorateSelectProps {
    id: string;
    /** The chosen zone's governorate, or '' when nothing is chosen yet. */
    value: string;
    zones: readonly ShippingZone[];
    locale: Locale;
    placeholder: string;
    /** Shown when the shopper types something no zone matches. */
    noResults: string;
    invalid: boolean;
    describedBy?: string;
    onSelect: (governorate: string) => void;
    /** Fired when the shopper leaves the field, to re-run validation. */
    onSettled: () => void;
    /** The text box itself, so the form can scroll to and focus it. */
    inputRef: (element: HTMLInputElement | null) => void;
}

/** Everything a shopper might type that should still find a zone. */
function searchText(zone: ShippingZone): string {
    // Both languages go in the haystack regardless of the page language, so an
    // Arabic shopper can paste the English name and an English one can paste the
    // Arabic without either being told they are wrong. A zone with no label
    // falls back to the name the API sent, which is the right thing to search
    // for anyway.
    return normalizePlaceName(
        `${governorateLabel(zone.governorate, 'en')} ${governorateLabel(zone.governorate, 'ar')}`,
    );
}

export default function GovernorateSelect({
    id,
    value,
    zones,
    locale,
    placeholder,
    noResults,
    invalid,
    describedBy,
    onSelect,
    onSettled,
    inputRef,
}: GovernorateSelectProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const listId = useId();
    const optionId = (index: number) => `${listId}-option-${index}`;

    const selected = zones.find((zone) => zone.governorate === value) ?? null;
    // With nothing chosen, the box shows the placeholder rather than an empty
    // gap; once chosen it shows the name, so the field reads as filled.
    const displayValue = isOpen ? query : selected ? governorateLabel(selected.governorate, locale) : '';

    const matches = useMemo(() => {
        const needle = normalizePlaceName(query);
        if (!needle) return zones;
        return zones.filter((zone) => searchText(zone).includes(needle));
    }, [zones, query]);

    // A shorter list must not leave the highlight pointing past its end.
    useEffect(() => {
        setActiveIndex((current) => (current < matches.length ? current : 0));
    }, [matches.length]);

    // A click anywhere else closes the list. Without this the options stay
    // painted over the page after the shopper has moved on.
    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [isOpen]);

    const choose = (zone: ShippingZone) => {
        onSelect(zone.governorate);
        setQuery('');
        setIsOpen(false);
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            if (!isOpen) return;
            event.preventDefault();
            setIsOpen(false);
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                return;
            }
            if (matches.length === 0) return;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((current) => (current + step + matches.length) % matches.length);
            return;
        }
        if (event.key === 'Home' && isOpen && matches.length) {
            event.preventDefault();
            setActiveIndex(0);
            return;
        }
        if (event.key === 'End' && isOpen && matches.length) {
            event.preventDefault();
            setActiveIndex(matches.length - 1);
            return;
        }
        if (event.key === 'Enter') {
            // Enter picks the highlighted option. It must not also submit the
            // form, or choosing a governorate would place the order.
            if (!isOpen || matches.length === 0) return;
            event.preventDefault();
            const zone = matches[activeIndex];
            if (zone) choose(zone);
        }
    };

    return (
        <div className="gov-select" ref={rootRef}>
            <input
                id={id}
                type="text"
                className="gov-select__input"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={isOpen && matches.length ? optionId(activeIndex) : undefined}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                autoComplete="off"
                placeholder={placeholder}
                value={displayValue}
                ref={inputRef}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setIsOpen(true);
                    setActiveIndex(0);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={onKeyDown}
                onBlur={onSettled}
            />
            {isOpen && (
                <ul className="gov-select__list" id={listId} role="listbox" aria-label={placeholder}>
                    {matches.length === 0 && <li className="gov-select__empty">{noResults}</li>}
                    {matches.map((zone, index) => {
                        const isSelected = zone.governorate === value;
                        return (
                            <li
                                key={zone.id}
                                id={optionId(index)}
                                role="option"
                                aria-selected={isSelected}
                                className={`gov-select__option${index === activeIndex ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                                onPointerDown={(event) => {
                                    // Pointer down, not click: the input's blur would
                                    // otherwise close the list before the click lands.
                                    event.preventDefault();
                                    choose(zone);
                                }}
                                onPointerEnter={() => setActiveIndex(index)}
                            >
                                {governorateLabel(zone.governorate, locale)}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
