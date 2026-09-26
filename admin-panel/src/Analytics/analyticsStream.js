import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../api/axiosInstance';

const SSE_PATH = '/api/v1/analytics/realtime';

/**
 * Real-time analytics push via Server-Sent Events (EventSource).
 *
 * Plain HTTP GET stream: the httpOnly `jwt` cookie rides the credentialed
 * request exactly like every other API call, so there is no WebSocket
 * handshake to break. Browsers reconnect natively on network drops.
 *
 * The stream is a module-level SINGLETON (refcounted): React.StrictMode's
 * dev-only double-mount shares one connection and consumer cleanups only
 * detach listeners, so the stream is never torn down mid-setup and no two
 * consumers open duplicate connections.
 *
 * Status: 'connecting' | 'live' | 'fallback'. REST polling fallback lives in
 * the consumers, not here.
 */

let sharedStream = null; // EventSource
let refCount = 0;
let sharedStatus = 'connecting'; // 'connecting' | 'live' | 'fallback'

const statusListeners = new Set();
const eventListeners = { events: new Set(), liveCounts: new Set() };

const setSharedStatus = (next) => {
    sharedStatus = next;
    statusListeners.forEach((fn) => fn(next));
};

const ensureStream = () => {
    if (sharedStream) return sharedStream;
    const stream = new EventSource(`${API_URL}${SSE_PATH}`, { withCredentials: true });
    stream.onopen = () => setSharedStatus('live');
    stream.onerror = () => setSharedStatus('fallback'); // EventSource auto-retries
    stream.addEventListener('analytics:event', (e) => {
        try {
            const payload = JSON.parse(e.data);
            eventListeners.events.forEach((fn) => fn(payload));
        } catch {
            /* malformed frame — ignore */
        }
    });
    stream.addEventListener('analytics:liveCount', (e) => {
        try {
            const { count } = JSON.parse(e.data);
            eventListeners.liveCounts.forEach((fn) => fn(Number(count || 0)));
        } catch {
            /* malformed frame — ignore */
        }
    });
    sharedStream = stream;
    return stream;
};

const destroyStream = () => {
    if (!sharedStream) return;
    sharedStream.close();
    sharedStream = null;
};

export const useAnalyticsStream = ({ onEvent, onLiveCount }) => {
    const [status, setStatus] = useState(sharedStatus);
    const onEventRef = useRef(onEvent);
    const onLiveCountRef = useRef(onLiveCount);
    onEventRef.current = onEvent;
    onLiveCountRef.current = onLiveCount;

    useEffect(() => {
        ensureStream();
        refCount += 1;

        const onStatus = (next) => setStatus(next);
        const onEventMsg = (event) => onEventRef.current?.(event);
        const onLiveMsg = (count) => onLiveCountRef.current?.(count);

        statusListeners.add(onStatus);
        eventListeners.events.add(onEventMsg);
        eventListeners.liveCounts.add(onLiveMsg);
        setStatus(sharedStatus); // sync current state in case we mounted mid-life

        return () => {
            statusListeners.delete(onStatus);
            eventListeners.events.delete(onEventMsg);
            eventListeners.liveCounts.delete(onLiveMsg);
            refCount -= 1;
            if (refCount <= 0) {
                refCount = 0;
                destroyStream();
                sharedStatus = 'connecting';
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { status, socket: sharedStream };
};