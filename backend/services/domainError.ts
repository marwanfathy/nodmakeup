// Shared domain-failure type. Services throw DomainError with the HTTP status
// + client-facing message they want sent; controllers map it via the `call`
// helper (controllers/admin/domainCall.ts) -> res.status(status) + throw.
export class DomainError extends Error {
    constructor(
        message: string,
        readonly status: number = 500,
    ) {
        super(message);
        this.name = 'DomainError';
    }
}