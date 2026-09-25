import { Response } from 'express';
import { DomainError } from '../../services/domainError';

/**
 * Runs a domain call, mapping DomainError (status + client-facing message)
 * onto the response the same way the legacy `res.status(n); throw` pattern
 * did, then rethrows a plain Error so the error middleware finishes the job.
 * Non-domain errors propagate untouched (asyncHandler -> 500).
 */
export const call = async <T>(res: Response, fn: () => Promise<T>): Promise<T> => {
    try {
        return await fn();
    } catch (err) {
        if (err instanceof DomainError) {
            res.status(err.status);
            throw new Error(err.message);
        }
        throw err;
    }
};