import { Decimal } from '@prisma/client/runtime/library';
import { DiscountType } from '@prisma/client';

// --- 1. Define the input type for clarity and safety ---
// This defines the minimum shape of the object our function needs.
interface Priceable {
    price: Decimal | number;
    discount_type?: DiscountType | null;
    discount_value?: Decimal | number | null;
}

// --- 2. Define the output type ---
// This describes the object our function will return.
interface PricedItem {
    original_price: number;
    effective_sale_price: number | null;
}

/**
 * @desc      Applies product-level discounts to a base price.
 * @param     {Priceable} item - An object containing price and optional discount info.
 * @returns   {PricedItem} An object with original_price and effective_sale_price.
 */
export const applyPriceLogic = (item: Priceable): PricedItem => {
    // Prisma's Decimal type needs to be converted to a number for calculations.
    const basePrice = Number(item.price) || 0;
    let finalPrice: number | null = null;

    if (item.discount_type && item.discount_value) {
        const discountValue = Number(item.discount_value);

        if (item.discount_type === DiscountType.PERCENTAGE) {
            finalPrice = basePrice * (1 - discountValue / 100);
        } else if (item.discount_type === DiscountType.FIXED_AMOUNT) {
            finalPrice = basePrice - discountValue;
        }
        // Note: 'FREE_SHIPPING' discount type doesn't affect the item price, so it's ignored here.
    }

    return {
        original_price: parseFloat(basePrice.toFixed(2)),
        effective_sale_price: (finalPrice !== null) 
            ? Math.max(0, parseFloat(finalPrice.toFixed(2))) 
            : null,
    };
};