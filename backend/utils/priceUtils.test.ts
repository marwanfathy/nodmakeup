import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { DiscountType } from '@prisma/client';
import { applyPriceLogic } from './priceUtils';

describe('applyPriceLogic', () => {
    it('returns original price with no discount', () => {
        expect(applyPriceLogic({ price: 100 })).toEqual({
            original_price: 100,
            effective_sale_price: null,
        });
    });

    it('accepts plain numbers and prisma Decimal', () => {
        expect(applyPriceLogic({ price: new Decimal('49.99') })).toEqual({
            original_price: 49.99,
            effective_sale_price: null,
        });
    });

    it('applies PERCENTAGE discount', () => {
        expect(applyPriceLogic({ price: 200, discount_type: DiscountType.PERCENTAGE, discount_value: 25 })).toEqual({
            original_price: 200,
            effective_sale_price: 150,
        });
    });

    it('applies FIXED_AMOUNT discount', () => {
        expect(applyPriceLogic({ price: 200, discount_type: DiscountType.FIXED_AMOUNT, discount_value: 40 })).toEqual({
            original_price: 200,
            effective_sale_price: 160,
        });
    });

    it('never returns a negative sale price', () => {
        expect(applyPriceLogic({ price: 30, discount_type: DiscountType.FIXED_AMOUNT, discount_value: 99 })).toEqual({
            original_price: 30,
            effective_sale_price: 0,
        });
    });

    it('ignores FREE_SHIPPING type (price unchanged)', () => {
        expect(applyPriceLogic({ price: 300, discount_type: DiscountType.FREE_SHIPPING, discount_value: 1 })).toEqual({
            original_price: 300,
            effective_sale_price: null,
        });
    });

    it('treats missing/invalid price as zero instead of NaN', () => {
        const { original_price } = applyPriceLogic({ price: undefined as unknown as number });
        expect(original_price).toBe(0);
        expect(Number.isNaN(original_price)).toBe(false);
    });

    it('rounds to 2 decimals', () => {
        expect(applyPriceLogic({ price: 49.9999, discount_type: DiscountType.PERCENTAGE, discount_value: 10 })).toEqual({
            original_price: 50,
            effective_sale_price: 45,
        });
    });
});