// app/components/PageTracker.js
"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryString } from '../../hooks/useQueryString';
import { trackPageView } from '../../lib/api';
import { getSessionId, getVisitorId } from '../../lib/visitor';

export function PageTracker() {
    const pathname = usePathname();
    // Read from window.location rather than useSearchParams(): a router
    // hook would make the whole route client-render and ship an empty body.
    const queryString = useQueryString();
    
    // Ref keeps the latest URL accessible to the heartbeat interval without re-triggering it
    const currentUrlRef = useRef(""); 

    // --- 1. TRACK NAVIGATION CHANGES ---
    // Triggered instantly when the user clicks a link or changes the URL
    useEffect(() => {
        const url = `${pathname}${queryString}`;
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
    }, [pathname, queryString]);

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