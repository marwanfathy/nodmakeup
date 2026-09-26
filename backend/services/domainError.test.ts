import { describe, expect, it } from 'vitest';
import { DomainError } from './domainError';

describe('DomainError', () => {
    it('defaults to status 500, keeps the message and name', () => {
        const e = new DomainError('boom');
        expect(e).toBeInstanceOf(Error);
        expect(e.status).toBe(500);
        expect(e.message).toBe('boom');
        expect(e.name).toBe('DomainError');
    });

    it('carries an explicit status', () => {
        expect(new DomainError('not found', 404).status).toBe(404);
        expect(new DomainError('bad request', 400).status).toBe(400);
    });
});