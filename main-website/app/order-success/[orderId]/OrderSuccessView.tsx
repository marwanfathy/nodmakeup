'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Confetti from 'react-confetti';
import { getPublicOrderDetails, OrderDetails, mediaUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';
import { localePath } from '@/lib/i18n/paths';
import { formatPrice } from '@/lib/format';
import './OrderSuccess.css';
const audiosrc = mediaUrl('uploads/audio/successfx.mp3');

export default function OrderSuccessPage() {
    const params = useParams();
    const { locale, t } = useI18n();
    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Respect OS-level reduced-motion: skip confetti + SFX for users who opt out.
    const [reducedMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    // Window size for Confetti
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const [showConfetti, setShowConfetti] = useState(true);

    // 1. Handle Window Resize
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 2. Fetch Order Data
    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const orderId = params?.id || params?.orderId;
                if (!orderId) throw new Error("Invalid Order Link");

                const data = await getPublicOrderDetails(String(orderId));
                setOrder(data);
            } catch (err: unknown) {
                console.error("Error fetching order:", err);
                setError(t('order.loadError'));
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [params]);

    // 3. Stop Confetti after 6 seconds (skipped entirely under reduced-motion)
    useEffect(() => {
        if (reducedMotion) return;
        const timer = setTimeout(() => setShowConfetti(false), 6000);
        return () => clearTimeout(timer);
    }, [reducedMotion]);

    // --- 4. NEW: Play SFX on Success ---
    useEffect(() => {
        // Only play if loading is done, we have an order, and motion is allowed
        if (!loading && order && !reducedMotion) {
            // Path references 'public/sounds/success.mp3'
            const audio = new Audio(`${audiosrc}`); 
            audio.volume = 0.5; // 50% volume so it's not too loud
            
            // Browsers require user interaction for audio. 
            // Since the user likely clicked "Checkout" on the previous page, this often works.
            // We catch errors just in case autoplay is blocked.
            audio.play().catch((err) => {
                console.warn("Audio autoplay blocked by browser:", err);
            });
        }
    }, [loading, order]);

    if (loading) {
        // Skeleton of the success card (icon, title, details box) rather than a
        // spinner: the order lookup is a network round trip, and on a weak
        // connection this is a long wait that a bare spinner cannot fill.
        return (
            <div className="order-success-page" aria-busy="true" aria-live="polite">
                <div className="success-card">
                    <div className="os-skeleton os-skeleton--icon" />
                    <div className="os-skeleton os-skeleton--bar" style={{ width: '55%', height: 26, marginBottom: 12 }} />
                    <div className="os-skeleton os-skeleton--bar" style={{ width: '75%', height: 14, marginBottom: 28 }} />
                    <div className="os-skeleton os-skeleton--box" />
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="order-success-page">
                <div className="error-card">
                    <h2>{t('order.notFound')}</h2>
                    <Link href={localePath('/', locale)} className="btn-home">{t('order.returnHome')}</Link>
                </div>
            </div>
        );
    }

    // Mapping Data (camelCase wire — see shared/api/types.ts)
    const data = order;
    const displayId = data.orderNumber || "N/A";
    const displayPayment = data.payment?.method ?? t('order.cashOnDelivery');

    return (
        <div className="order-success-page" style={{ position: 'relative', overflow: 'hidden' }}>
            
            {/* Confetti Animation */}
            {showConfetti && !reducedMotion && (
            <Confetti
                width={windowSize.width}
                height={windowSize.height}
                recycle={showConfetti}
                numberOfPieces={200}
                gravity={0.2}
            />
            )}

            <div className="success-card" style={{ position: 'relative', zIndex: 10 }}>
                <div className="success-icon-wrapper">
                    <svg className="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                
                <h1 className="success-title">{t('order.thankYou')}</h1>
                <p className="success-subtitle">{t('order.placed')}</p>

                <div className="order-details-box">
                    <div className="detail-row">
                        <span>{t('order.number')}</span>
                        <strong>#{displayId}</strong>
                    </div>
                    <div className="detail-row">
                        <span>{t('order.totalAmount')}</span>
                        <strong>{formatPrice(data.summary?.totalPrice ?? 0, locale)}</strong>
                    </div>
                    <div className="detail-row">
                        <span>{t('order.payment')}</span>
                        <strong>{displayPayment}</strong>
                    </div>
                </div>

                <div className="success-actions">
                    <Link
                        href={`${localePath('/track', locale)}?orderNumber=${encodeURIComponent(displayId)}`}
                        className="btn-track"
                    >
                        {t('footer.track')}
                    </Link>
                    <Link href={localePath('/', locale)} className="btn-continue">
                        {t('order.continueShopping')}
                    </Link>
                </div>
                
                <p className="email-note">
                    {t('order.emailNote')}
                </p>
            </div>
        </div>
    );
}