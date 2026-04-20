// app/components/PageTracker.js
"use client";

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { trackPageView } from '../lib/api'; 

// --- Tip #1: Singleton pattern for stable Visitor Identification ---
let visitorIdPromise = null;

const getVisitorId = async () => {
    if (typeof window === 'undefined') return null;
    
    // Check localStorage first for speed (Tip #7 mindset)
    const cachedId = localStorage.getItem('visitorId');
    if (cachedId) return cachedId;

    if (!visitorIdPromise) {
        visitorIdPromise = (async () => {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            localStorage.setItem('visitorId', result.visitorId);
            return result.visitorId;
        })();
    }
    return visitorIdPromise;
};

export function PageTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // Ref keeps the latest URL accessible to the heartbeat interval without re-triggering it
    const currentUrlRef = useRef(""); 

    // --- 1. TRACK NAVIGATION CHANGES ---
    // Triggered instantly when the user clicks a link or changes the URL
    useEffect(() => {
        const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        currentUrlRef.current = url;

        const recordNavigation = async () => {
            try {
                const visitorId = await getVisitorId();
                if (!visitorId) return;

                // Tip #12: Fire and forget. Backend handles the non-blocking write.
                trackPageView(url, visitorId);
            } catch (err) {
                // Silent fail to ensure user experience isn't affected
            }
        };

        recordNavigation();
    }, [pathname, searchParams]);

    // --- 2. HEARTBEAT (Tip #7: LIVE STATUS) ---
    // Runs every 30 seconds to keep the user "Live" in Redis
    useEffect(() => {
        let intervalId;

        const startHeartbeat = async () => {
            const visitorId = await getVisitorId();
            if (!visitorId) return;

            intervalId = setInterval(() => {
                // We send the current URL from the Ref.
                // Backend logic: 
                //   1. Updates Redis (Fast).
                //   2. Compares path to last path. 
                //   3. Path is the same? -> Skips MySQL (Protects your DB).
                trackPageView(currentUrlRef.current, visitorId);
            }, 30000); 
        };

        startHeartbeat();

        // Cleanup interval on component unmount
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, []); 

    return null;
}