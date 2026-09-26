import { Decimal } from '@prisma/client/runtime/library';

export function formatDecimal(val: unknown): number {
    if (val instanceof Decimal) return val.toNumber();
    if (typeof val === 'string') return parseFloat(val);
    if (typeof val === 'number') return val;
    return 0;
}