import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data from an async fetcher, with a refetchIndex bump trigger.
 * Params are shallow-compared each render — object identity churn never
 * causes an accidental refetch loop.
 * Returns { data, loading, error, reload }.
 */
const shallowEqual = (a, b) => {
    if (a === b) return true;
    const keysA = Object.keys(a || {});
    const keysB = Object.keys(b || {});
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => a[k] === b[k]);
};

const useFetchData = (fetcher, refetchIndex = 0, params = {}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const mounted = useRef(true);
    const fetcherRef = useRef(fetcher);
    const paramsRef = useRef(params);
    const prevParamsRef = useRef(params);
    fetcherRef.current = fetcher;
    paramsRef.current = params;

    const paramsChanged = !shallowEqual(params, prevParamsRef.current);
    if (paramsChanged) prevParamsRef.current = params;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        mounted.current = true;
        try {
            const result = await fetcherRef.current(paramsRef.current);
            if (mounted.current) setData(result);
        } catch (err) {
            if (mounted.current) {
                setError(err?.response?.data?.message || err?.message || 'Failed to load data.');
            }
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        load();
        return () => { mounted.current = false; };
    }, [load, refetchIndex, paramsChanged]);

    return { data, loading, error, reload: load };
};

export default useFetchData;