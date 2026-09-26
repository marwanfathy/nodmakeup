"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '../contexts/CartContext'; // Adjust path if needed
import { 
    createOrder, 
    getShippingZones, 
    validateCoupon, 
    ShippingZone, 
    AppliedDiscount,
    CartItemPublic,
    mediaUrl,
} from '@/lib/api';
import { toast } from 'react-toastify'; 
import Spinner from '../../components/ui/Spinner'; // shared loading spinner
import { useI18n } from '../i18n/client';
import { localePath } from '../i18n/paths';
import { formatPrice } from '../../lib/format';
import { normalizeEgyptianPhone, isValidEgyptianPhone, toInternationalEgyptianPhone, formatPhoneForLocale, EG_PHONE_PREFIX } from '../../lib/phone';
import { getCurrentPosition, describePosition, mergeAddress, GeoError, ADDRESS_MAX } from '../../lib/geolocation';
import './CheckoutPage.css';

interface FormData {
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    shipping_governorate: string;
    customer_notes: string;
}

type FieldName = keyof FormData;
type FieldErrors = Partial<Record<FieldName, string>>;

const NOTES_MAX = 500;

const ShippingIcon = () => (<svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>);
const PaymentIcon = () => (<svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>);
// Crosshair/target for "use my current location".
const LocationIcon = () => (<svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2.5"></circle><line x1="12" y1="1" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="23"></line><line x1="1" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="23" y2="12"></line></svg>);
// Egypt flag for the phone prefix — same asset the navbar region link uses.
const flagIconPath = mediaUrl('/uploads/assets/icons/flag-egypt.svg');

export default function CheckoutPage() {
    const { cart, fetchCart, updateItemQuantity, removeItem, isCartLoading } = useCart();
    const router = useRouter();
    const { locale, t } = useI18n();

    const [formData, setFormData] = useState<FormData>({
        customer_name: '', 
        customer_phone: '', 
        customer_address: '',
        shipping_governorate: '', 
        customer_notes: '',
    });

    const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
    const [areZonesLoading, setAreZonesLoading] = useState(true);
    const [isOrderPlaced, setIsOrderPlaced] = useState(false);
    // Per-field validation: every field reports its own problem, and only once
    // it has been visited (or after a submit attempt) so the form stays quiet.
    const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const fieldRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
    // "Use my current location": the button's own state, kept apart from the
    // field's validation error because a geolocation problem is not a
    // validation problem — the address may already be fine.
    const [isLocating, setIsLocating] = useState(false);
    const [geoNote, setGeoNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

    useEffect(() => {
        if (!cart && !isCartLoading) {
            fetchCart();
        }
    }, [fetchCart, cart, isCartLoading]);

    useEffect(() => {
        const fetchZones = async () => {
            try {
                const response = await getShippingZones();
                setShippingZones(response || []);
            } catch {
                toast.error(t('checkout.toast.shippingFailed'));
            } finally {
                setAreZonesLoading(false);
            }
        };
        fetchZones();
    }, []);

    useEffect(() => {
        if (isCartLoading || isOrderPlaced) return;

        if (!cart || cart.items.length === 0) {
            const timer = setTimeout(() => {
                if (!isOrderPlaced) { 
                    toast.info(t('checkout.toast.emptyCart'));
                    router.replace(localePath('/shop', locale));
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [cart, isCartLoading, router, isOrderPlaced]);

    const { shippingCost, discountAmount, total, subtotal, originalShippingCost } = useMemo(() => {
        const sub = cart?.summary?.subtotal || 0;
        const selectedZone = shippingZones.find((z) => z.governorate === formData.shipping_governorate);
        const baseShipping = selectedZone ? parseFloat(String(selectedZone.shippingCost)) : 0;
        
        let displayDiscountAmount = 0;
        let subtotalDiscount = 0;
        let finalShippingCost = baseShipping;

        if (appliedDiscount) {
            if (appliedDiscount.discountType === 'PERCENTAGE') {
                const discount = sub * (parseFloat(String(appliedDiscount.value)) / 100);
                displayDiscountAmount = Math.min(sub, discount);
                subtotalDiscount = displayDiscountAmount;
            } else if (appliedDiscount.discountType === 'FIXED_AMOUNT') {
                const discount = parseFloat(String(appliedDiscount.value));
                displayDiscountAmount = Math.min(sub, discount);
                subtotalDiscount = displayDiscountAmount;
            } else if (appliedDiscount.discountType === 'FREE_SHIPPING') {
                finalShippingCost = 0;
                displayDiscountAmount = baseShipping;
            }
        }

        const finalTotal = sub - subtotalDiscount + finalShippingCost;

        return { 
            shippingCost: finalShippingCost,
            originalShippingCost: baseShipping,
            discountAmount: displayDiscountAmount,
            total: finalTotal,
            subtotal: sub 
        };
    }, [formData.shipping_governorate, cart, shippingZones, appliedDiscount]);

    // --- Per-field validation -------------------------------------------
    // One rule per field, so each input can explain its own problem instead of
    // a single "fill everything in" toast. The phone is checked after
    // normalization, which is what actually gets submitted.
    const validateField = (field: FieldName, values: FormData): string | undefined => {
        switch (field) {
            case 'customer_name': {
                const value = values.customer_name.trim();
                if (!value) return t('checkout.err.nameRequired');
                if (value.length < 3) return t('checkout.err.nameShort');
                return undefined;
            }
            case 'customer_phone': {
                if (!values.customer_phone.trim()) return t('checkout.err.phoneRequired');
                if (!isValidEgyptianPhone(normalizeEgyptianPhone(values.customer_phone)))
                    return t('checkout.err.phoneInvalid');
                return undefined;
            }
            case 'customer_address': {
                const value = values.customer_address.trim();
                if (!value) return t('checkout.err.addressRequired');
                if (value.length < 5) return t('checkout.err.addressShort');
                return undefined;
            }
            case 'shipping_governorate':
                return values.shipping_governorate ? undefined : t('checkout.err.govRequired');
            case 'customer_notes':
                return values.customer_notes.length > NOTES_MAX ? t('checkout.err.notesLong') : undefined;
            default:
                return undefined;
        }
    };

    const validateAll = (values: FormData): FieldErrors => {
        const next: FieldErrors = {};
        (Object.keys(values) as FieldName[]).forEach((field) => {
            const message = validateField(field, values);
            if (message) next[field] = message;
        });
        return next;
    };

    /** Re-run one field's rule, but only surface it if the field was visited. */
    const revalidate = (field: FieldName, values: FormData) => {
        setErrors((prev) => {
            const message = touched[field] || submitAttempted ? validateField(field, values) : undefined;
            if (message === prev[field]) return prev;
            const next = { ...prev };
            if (message) next[field] = message;
            else delete next[field];
            return next;
        });
    };

    const handleBlur = (field: FieldName) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        // touched is still stale in this closure, so evaluate visibility directly.
        setErrors((prev) => {
            const message = validateField(field, formData);
            if (message === prev[field]) return prev;
            const next = { ...prev };
            if (message) next[field] = message;
            else delete next[field];
            return next;
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const field = e.target.name as FieldName;
        const raw = e.target.value;

        if (field === 'customer_notes') {
            // Hard cap instead of a silent reject, so typing never fights the UI.
            const next = { ...formData, [field]: raw.slice(0, NOTES_MAX) } as FormData;
            setFormData(next);
            revalidate(field, next);
            return;
        }

        if (field === 'customer_phone') {
            // Keep only the national digits: the leading 0 (and any pasted
            // +20/00) is dropped as it is typed, so the value can never become
            // the +2001… form and the +20 stays fixed in the UI.
            const next = { ...formData, customer_phone: normalizeEgyptianPhone(raw) } as FormData;
            setFormData(next);
            revalidate(field, next);
            return;
        }

        const next = { ...formData, [field]: raw } as FormData;
        setFormData(next);
        revalidate(field, next);
        // A stale "location added" note would contradict what is now typed.
        if (field === 'customer_address') setGeoNote(null);
    };

    /**
     * Fill the address from the device's GPS position. The permission prompt is
     * the slow part, so the button reports progress, and a failure explains
     * itself instead of leaving an empty field behind.
     */
    const handleUseCurrentLocation = async () => {
        if (isLocating) return;
        setIsLocating(true);
        setGeoNote(null);

        try {
            const coords = await getCurrentPosition();
            // Coordinates alone are not an address a driver can read, so a street
            // address is resolved too — with the pin kept either way.
            const detected = await describePosition(coords, locale);
            const next = { ...formData, customer_address: mergeAddress(formData.customer_address, detected) } as FormData;
            setFormData(next);
            revalidate('customer_address', next);
            setGeoNote({ tone: 'ok', text: t('checkout.geoFound') });
        } catch (error) {
            const reason = error instanceof GeoError ? error.reason : 'unavailable';
            setGeoNote({ tone: 'warn', text: t(`checkout.geo.${reason}`) });
        } finally {
            setIsLocating(false);
        }
    };

    // --- UPDATED FUNCTION ---
    const handleApplyCoupon = async () => {
        if (!couponCode) { 
            toast.info(t('checkout.toast.couponEmpty')); 
            return; 
        }

        // Check if phone is empty before validating personalized codes
        // This prevents the error if the user types the code before their details
        if (!formData.customer_phone && couponCode.toUpperCase().startsWith('THANKS-')) {
            toast.warning(t('checkout.toast.couponPhone'));
            return;
        }

        setIsApplyingCoupon(true);
        try {
            // Send the same E.164 form the order is stored with, so a
            // personalized coupon matches the customer's number.
            const phoneForCoupon = normalizeEgyptianPhone(formData.customer_phone);
            const validatedCoupon = await validateCoupon(
                couponCode,
                phoneForCoupon ? toInternationalEgyptianPhone(phoneForCoupon) : '',
            );
            
            setAppliedDiscount(validatedCoupon);
            toast.success(t('checkout.toast.couponApplied', { name: validatedCoupon.name }));
        } catch (error: unknown) {
            setAppliedDiscount(null);
            const message =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    : undefined;
            toast.error(message || t('checkout.toast.couponFailed'));
        } finally {
            setIsApplyingCoupon(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Surface every problem at once, then send the user to the first one.
        setSubmitAttempted(true);
        const found = validateAll(formData);
        setErrors(found);
        if (Object.keys(found).length > 0) {
            const firstInvalid = (Object.keys(formData) as FieldName[]).find((f) => found[f]);
            if (firstInvalid) {
                const el = fieldRefs.current[firstInvalid];
                el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                el?.focus?.();
            }
            toast.error(t('checkout.err.summary'));
            return;
        }

        setIsProcessing(true);

        try {
            const checkoutData = {
                customerName: formData.customer_name.trim(),
                // Submitted as E.164 — the trunk 0 is already gone, so this is
                // always +20xxxxxxxxx and never +2001…
                customerPhone: toInternationalEgyptianPhone(
                    normalizeEgyptianPhone(formData.customer_phone),
                ),
                customerAddress: formData.customer_address.trim(),
                shippingGovernorate: formData.shipping_governorate,
                customerNotes: formData.customer_notes || undefined,
                couponCode: appliedDiscount ? couponCode : undefined,
                checkoutKey: typeof crypto !== 'undefined' && (crypto as Crypto).randomUUID
                    ? (crypto as Crypto).randomUUID()
                    : `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                paymentMethod: 'CashOnDelivery' as const 
            };

            const response = await createOrder(checkoutData);
            
            setIsOrderPlaced(true); 
            await fetchCart(); 
            router.push(localePath(`/order-success/${response.orderId}`, locale));
        } catch (error: unknown) {
            const message =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    : undefined;
            toast.error(message || t('checkout.toast.checkoutFailed'));
            setIsProcessing(false);
        } 
    };
    
    if (isCartLoading || areZonesLoading || !cart) {
        // A skeleton of the real two-column layout, not a spinner: the cart and
        // the shipping zones both come over the network, and on a weak connection
        // that wait is long enough that a bare spinner reads as a broken page.
        // No loading text anywhere — the placeholders already say "form" and
        // "summary" by their shape.
        return (
            <div className="modern-checkout-page">
                <div className="checkout-container" aria-busy="true" aria-live="polite">
                    <div className="checkout-form-column">
                        <header className="checkout-header">
                            <div className="co-skeleton co-skeleton--logo" />
                            <div className="co-skeleton co-skeleton--bar" style={{ width: 180, height: 14 }} />
                        </header>

                        {[{ fields: 3 }, { fields: 3 }, { fields: 1 }].map((section, si) => (
                            <div className="form-section" key={si}>
                                <div className="section-header">
                                    <div className="co-skeleton co-skeleton--icon" />
                                    <div className="co-skeleton co-skeleton--bar" style={{ width: 120, height: 16 }} />
                                </div>
                                {Array.from({ length: section.fields }).map((_, fi) => (
                                    <div className="checkout-field" key={fi}>
                                        <div className="co-skeleton co-skeleton--bar" style={{ width: 90, height: 11 }} />
                                        <div className="co-skeleton co-skeleton--field" />
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div className="co-skeleton co-skeleton--pill" />
                    </div>

                    <div className="order-summary-column">
                        <div className="order-summary-box">
                            <div className="co-skeleton co-skeleton--bar" style={{ width: 140, height: 16, marginBottom: 20 }} />
                            {[0, 1].map((i) => (
                                <div className="co-summary-row" key={i}>
                                    <div className="co-skeleton co-skeleton--thumb" />
                                    <div className="co-summary-lines">
                                        <div className="co-skeleton co-skeleton--bar" style={{ width: '70%', height: 12 }} />
                                        <div className="co-skeleton co-skeleton--bar" style={{ width: '40%', height: 12 }} />
                                    </div>
                                </div>
                            ))}
                            <div className="co-skeleton co-skeleton--bar" style={{ width: '100%', height: 44, marginTop: 20 }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (cart.items.length === 0 && !isOrderPlaced) return null;

    return (
        <div className="modern-checkout-page">
            <div className="checkout-container">
                <div className="checkout-form-column">
                    <header className="checkout-header">
                        <Link href={localePath('/', locale)} className="checkout-logo-link" aria-label="NOD Makeup home">
                            <Image
                                src={mediaUrl('/uploads/images/l(dark).png')}
                                alt="NOD Makeup"
                                className="checkout-logo"
                                width={1774}
                                height={887}
                                sizes="110px"
                            />
                        </Link>
                        <p>{t('checkout.header')}</p>
                    </header>
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="form-section">
                            <div className="section-header"><ShippingIcon /><h3>{t('checkout.shipping')}</h3></div>

                            {/* Each field owns its label, its value and its error, so a
                                problem is reported where it happens instead of in a toast. */}
                            <div className={`checkout-field ${errors.customer_name ? 'has-error' : ''}`}>
                                <label htmlFor="customer_name">{t('checkout.fullName')}</label>
                                <input
                                    id="customer_name"
                                    name="customer_name"
                                    type="text"
                                    placeholder={t('checkout.fullName')}
                                    autoComplete="name"
                                    required
                                    ref={(el) => { fieldRefs.current.customer_name = el; }}
                                    aria-invalid={Boolean(errors.customer_name)}
                                    aria-describedby={errors.customer_name ? 'err-customer_name' : undefined}
                                    onChange={handleInputChange}
                                    onBlur={() => handleBlur('customer_name')}
                                    value={formData.customer_name}
                                />
                                {errors.customer_name && <span className="field-error" id="err-customer_name">{errors.customer_name}</span>}
                            </div>

                            <div className={`checkout-field checkout-field--phone ${errors.customer_phone ? 'has-error' : ''}`}>
                                <label htmlFor="customer_phone">{t('checkout.phone')}</label>
                                {/* Fixed Egyptian dialling code: the flag and +20 are chrome,
                                    the input only ever holds the national digits. */}
                                <div className="phone-input">
                                    <span className="phone-prefix" aria-hidden="true">
                                        <img className="phone-prefix__flag" src={flagIconPath} alt="" />
                                        <span className="phone-prefix__code">{formatPhoneForLocale(EG_PHONE_PREFIX, locale)}</span>
                                    </span>
                                    <input
                                        id="customer_phone"
                                        name="customer_phone"
                                        type="tel"
                                        inputMode="numeric"
                                        autoComplete="tel-national"
                                        /* Egyptian and Arabic keyboards type Arabic-Indic
                                           digits, so the Arabic page shows them natively.
                                           The value underneath stays Latin. */
                                        placeholder={formatPhoneForLocale('1012345678', locale)}
                                        required
                                        ref={(el) => { fieldRefs.current.customer_phone = el; }}
                                        aria-invalid={Boolean(errors.customer_phone)}
                                        aria-describedby={`phone-hint${errors.customer_phone ? ' err-customer_phone' : ''}`}
                                        onChange={handleInputChange}
                                        onBlur={() => handleBlur('customer_phone')}
                                        value={formatPhoneForLocale(formData.customer_phone, locale)}
                                    />
                                </div>
                                <div className="phone-meta">
                                    <span className="field-hint" id="phone-hint">{t('checkout.phoneHint')}</span>
                                    {/* Live echo of the number that will actually be stored,
                                        so the expected form is never a guess. */}
                                    {formData.customer_phone && (
                                        <span className="phone-preview" aria-live="polite">
                                            {formatPhoneForLocale(toInternationalEgyptianPhone(formData.customer_phone), locale)}
                                        </span>
                                    )}
                                </div>
                                {errors.customer_phone && <span className="field-error" id="err-customer_phone">{errors.customer_phone}</span>}
                            </div>

                            <div className={`checkout-field ${errors.customer_address ? 'has-error' : ''}`}>
                                <label htmlFor="customer_address">{t('checkout.address')}</label>
                                <input
                                    id="customer_address"
                                    name="customer_address"
                                    type="text"
                                    placeholder={t('checkout.address')}
                                    autoComplete="street-address"
                                    required
                                    /* The address column is VarChar(255); capping here
                                       means a pasted novel fails at the input rather
                                       than as a database error at submit. */
                                    maxLength={ADDRESS_MAX}
                                    ref={(el) => { fieldRefs.current.customer_address = el; }}
                                    aria-invalid={Boolean(errors.customer_address)}
                                    aria-describedby={errors.customer_address ? 'err-customer_address' : undefined}
                                    onChange={handleInputChange}
                                    onBlur={() => handleBlur('customer_address')}
                                    value={formData.customer_address}
                                />
                                {/* Secondary action, so it never competes with the
                                    field itself: a phone without GPS can still type. */}
                                <button
                                    type="button"
                                    className="geo-btn"
                                    onClick={handleUseCurrentLocation}
                                    disabled={isLocating}
                                    aria-busy={isLocating}
                                >
                                    {isLocating ? <Spinner size="small" /> : <LocationIcon />}
                                    <span>{isLocating ? t('checkout.locating') : t('checkout.useLocation')}</span>
                                </button>
                                {geoNote && (
                                    <span className={`geo-note geo-note--${geoNote.tone}`} role="status">
                                        {geoNote.text}
                                    </span>
                                )}
                                {errors.customer_address && <span className="field-error" id="err-customer_address">{errors.customer_address}</span>}
                            </div>

                            <div className={`checkout-field ${errors.shipping_governorate ? 'has-error' : ''}`}>
                                <label htmlFor="shipping_governorate">{t('checkout.governorate')}</label>
                                <select
                                    id="shipping_governorate"
                                    name="shipping_governorate"
                                    required
                                    ref={(el) => { fieldRefs.current.shipping_governorate = el; }}
                                    aria-invalid={Boolean(errors.shipping_governorate)}
                                    aria-describedby={errors.shipping_governorate ? 'err-shipping_governorate' : undefined}
                                    onChange={handleInputChange}
                                    onBlur={() => handleBlur('shipping_governorate')}
                                    value={formData.shipping_governorate}
                                >
                                    <option value="">{t('checkout.governorate')}</option>
                                    {shippingZones.map(zone => <option key={zone.id} value={zone.governorate}>{zone.governorate}</option>)}
                                </select>
                                {errors.shipping_governorate && <span className="field-error" id="err-shipping_governorate">{errors.shipping_governorate}</span>}
                            </div>

                            <div className={`checkout-field ${errors.customer_notes ? 'has-error' : ''}`}>
                                <label htmlFor="customer_notes">{t('checkout.notes')}</label>
                                <textarea
                                    id="customer_notes"
                                    name="customer_notes"
                                    placeholder={t('checkout.notes')}
                                    maxLength={NOTES_MAX}
                                    ref={(el) => { fieldRefs.current.customer_notes = el; }}
                                    aria-invalid={Boolean(errors.customer_notes)}
                                    aria-describedby={errors.customer_notes ? 'err-customer_notes' : undefined}
                                    onChange={handleInputChange}
                                    onBlur={() => handleBlur('customer_notes')}
                                    value={formData.customer_notes}
                                ></textarea>
                                {errors.customer_notes && <span className="field-error" id="err-customer_notes">{errors.customer_notes}</span>}
                            </div>
                        </div>

                        <div className="form-section">
                            <div className="section-header"><PaymentIcon /><h3>{t('checkout.payment')}</h3></div>
                            <div className="payment-option selected">
                                <input type="radio" name="payment_method" value="CashOnDelivery" checked readOnly style={{ accentColor: '#007bff' }}/>
                                <span>{t('checkout.cod')}</span>
                            </div>
                        </div>

                        <div className="checkout-actions">
                            <Link href={localePath('/', locale)} className="return-to-cart-link"> {t('checkout.continue')}</Link>
                            <button type="submit" className="place-order-button" data-track="place_order" disabled={isProcessing}>
                                {isProcessing ? <Spinner /> : t('checkout.placeOrder', { total: formatPrice(total, locale) })}
                            </button>
                        </div>
                    </form>
                </div>
                
                <div className="order-summary-column">
                    <div className="order-summary-box">
                        {cart.items.map((item: CartItemPublic) => {
                            const displayPrice = item.effectiveSalePrice ?? item.originalPrice;
                            const imageUrl = mediaUrl(item.imageUrl) || '/default-image.png';
                            const itemName = locale === 'ar' ? (item.productNameAr || item.productName) : item.productName;
                            return (
                               <div className="summary-item" key={item.id}>
                                   <div className="summary-item-image">
                                       <Image src={imageUrl} alt={itemName} width={72} height={120} sizes="72px" />
                                       <span className="summary-item-quantity">{item.quantity}</span>
                                   </div>
                                   <div className="summary-item-details">
                                       <div className="summary-item-text">
                                           <h4>{itemName}</h4>
                                           <p>{[item.colorName, item.size].filter(Boolean).join(' / ')}</p>
                                       </div>
                                       {/* Price on its own line: below the name, above the quantity */}
                                       <div className="summary-item-price"><span>{formatPrice(displayPrice * item.quantity, locale)}</span></div>
                                       <div className="summary-item-controls">
                                           <div className="quantity-control">
                                               <button type="button" onClick={() => updateItemQuantity(item.id, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                                               <span>{item.quantity}</span>
                                               <button type="button" onClick={() => updateItemQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity">+</button>
                                           </div>
                                           <button type="button" className="remove-item-btn" onClick={() => removeItem(item.id)}>{t('checkout.remove')}</button>
                                       </div>
                                   </div>
                               </div>
                           );
                        })}

                        <div className="discount-section">
                            <input type="text" placeholder={t('checkout.discountCode')} value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} disabled={isApplyingCoupon || appliedDiscount !== null}/>
                            <button type="button" onClick={handleApplyCoupon} disabled={isApplyingCoupon || appliedDiscount !== null}>
                                {isApplyingCoupon ? <Spinner size="small" /> : t('checkout.apply')}
                            </button>
                        </div>
                        
                        <div className="cost-summary">
                            <div className="cost-line"><span>{t('checkout.subtotal')}</span><span>{formatPrice(subtotal, locale)}</span></div>
                            
                            {appliedDiscount && discountAmount > 0 && (
                                <div className="cost-line discount">
                                    <span>{t('checkout.discount', { name: appliedDiscount.name })}</span>
                                    <span>- {formatPrice(discountAmount, locale)}</span>
                                </div>
                            )}

                            <div className="cost-line">
                                <span>{t('checkout.shippingCost')}</span>
                                {appliedDiscount?.discountType === 'FREE_SHIPPING' ? (
                                    <span className="free-shipping-display">
                                        <del>{formatPrice(originalShippingCost, locale)}</del> {t('checkout.free')}
                                    </span>
                                ) : (
                                    <span>{formData.shipping_governorate ? formatPrice(shippingCost, locale) : t('checkout.selectGov')}</span>
                                )}
                            </div>
                            
                            <div className="cost-line total"><span>{t('checkout.total')}</span><span className="total-price">{formatPrice(total, locale)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};