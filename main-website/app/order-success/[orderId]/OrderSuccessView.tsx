'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Confetti from 'react-confetti';
import { getPublicOrderDetails, OrderDetails, mediaUrl } from '@/lib/api';
import Spinner from '@/components/ui/Spinner'; 
import './OrderSuccess.css';
const audiosrc = mediaUrl('uploads/audio/successfx.mp3');

export default function OrderSuccessPage() {
    const params = useParams();
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
                setError('Could not load order details.');
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

    if (loading) return <div className="order-success-page"><Spinner /></div>;

    if (error || !order) {
        return (
            <div className="order-success-page">
                <div className="error-card">
                    <h2>Order Not Found</h2>
                    <Link href="/" className="btn-home">Return Home</Link>
                </div>
            </div>
        );
    }

    // Mapping Data (camelCase wire — see shared/api/types.ts)
    const data = order;
    const displayId = data.orderNumber || "N/A";
    const rawPrice = data.summary?.totalPrice ?? 0;
    const displayPrice = Number(rawPrice).toFixed(2);
    const displayPayment = data.payment?.method ?? 'Cash on Delivery';

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
                
                <h1 className="success-title">Thank You!</h1>
                <p className="success-subtitle">Your order has been placed successfully.</p>

                <div className="order-details-box">
                    <div className="detail-row">
                        <span>Order Number</span>
                        <strong>#{displayId}</strong>
                    </div>
                    <div className="detail-row">
                        <span>Total Amount</span>
                        <strong>EGP {displayPrice}</strong>
                    </div>
                    <div className="detail-row">
                        <span>Payment Method</span>
                        <strong>{displayPayment}</strong>
                    </div>
                </div>

                <div className="success-actions">
                    <Link href="/" className="btn-continue">
                        Continue Shopping
                    </Link>
                </div>
                
                <p className="email-note">
                    You will receive a confirmation call or email shortly.
                </p>
            </div>
        </div>
    );
}