// app/components/PageTracker.js
"use client";

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '../lib/api';
import { getSessionId, getVisitorId } from '../lib/visitor';

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
                trackPageView(url, visitorId, getSessionId());
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
                trackPageView(currentUrlRef.current, visitorId, getSessionId());
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