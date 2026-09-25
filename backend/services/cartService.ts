// Cart service — anonymous shopping-cart domain.
// Owns session resolution, line-item mutations and coupon/pricing assembly;
// controllers translate HTTP only. Response shapes here ARE the public
// cart API contract (parity with the legacy handlers).
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/prismaClient';
import { applyPriceLogic } from '../utils/priceUtils';
import { logger } from '../config/logger';

// ----------------------------- config -----------------------------

export const FREE_SHIPPING_THRESHOLD = 1500;
export const FREE_SHIPPING_COUPON_CODE = '7FRUXTT0';
export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 50;

// ----------------------------- types -----------------------------

export interface CartItemPublic {
    id: string;
    quantity: number;
    variantId: string;
    sku: string;
    stockQuantity: number;
    colorName: string | null;
    size: string | null;
    productId: string;
    productName: string;
    productSlug: string;
    imageUrl: string | null;
    originalPrice: number;
    effectiveSalePrice: number | null;
}

export interface CartObject {
    cartSessionId: string;
    items: CartItemPublic[];
    summary: {
        subtotal: number;
        discountAmount: number;
        total: number;
        itemCount: number;
        freeShippingThreshold: number;
        amountLeftForFreeShipping: number;
        appliedCoupon?: {
            code: string;
            type: string;
            value: number; // The value of the discount (e.g. 100% off shipping or fixed amount)
        };
    };
}

/** Result of adding a line; the two failure kinds map to 400s in the controller. */
export type AddItemResult =
    | { kind: 'added'; cart: CartObject }
    | { kind: 'line_quantity_cap' }
    | { kind: 'line_count_cap' };

// ----------------------------- session -----------------------------

/** Validates a client-provided session id against the DB; null when absent or stale. */
export async function resolveSession(sessionId: string | undefined): Promise<string | null> {
    if (!sessionId) return null;
    const session = await prisma.shoppingCartSession.findUnique({ where: { id: sessionId } });
    return session ? sessionId : null;
}

/** Creates and persists a new anonymous cart session. */
export async function createSession(): Promise<string> {
    const id = uuidv4();
    await prisma.shoppingCartSession.create({ data: { id } });
    return id;
}

// ----------------------------- assembly -----------------------------

/** Builds the full cart projection (items + coupon-adjusted totals) for a session. */
export async function buildCartObject(sessionId: string): Promise<CartObject> {
    const cartItems = await prisma.shoppingCartItem.findMany({
        where: { cartSessionId: sessionId },
        orderBy: { id: 'asc' },
        include: {
            variant: {
                include: {
                    product: { include: { discount: { where: { isActive: true } } } },
                    images: { orderBy: { displayOrder: 'asc' }, take: 1 },
                },
            },
        },
    });

    const session = await prisma.shoppingCartSession.findUnique({
        where: { id: sessionId },
    });

    const processedItems: CartItemPublic[] = [];

    for (const item of cartItems) {
        try {
            if (!item.variant || !item.variant.product) continue;
            const { variant } = item;
            const { product } = variant;
            const imageUrl = variant.images[0]?.imageUrl ?? null;
            const pricing = applyPriceLogic({
                price: variant.price,
                discount_type: product.discount?.type,
                discount_value: product.discount?.value,
            });

            processedItems.push({
                id: item.id,
                quantity: item.quantity,
                variantId: variant.id,
                sku: variant.sku,
                stockQuantity: variant.stockQuantity,
                colorName: variant.colorName,
                size: variant.size,
                productId: product.id,
                productName: product.name,
                productSlug: product.slug,
                imageUrl,
                originalPrice: pricing.original_price,
                effectiveSalePrice: pricing.effective_sale_price,
            });
        } catch (error) {
            logger.error({ error, cartItemId: item.id }, 'error processing cart item');
        }
    }

    let subtotal = processedItems.reduce((acc, item) => {
        const price = item.effectiveSalePrice ?? item.originalPrice;
        return acc + price * item.quantity;
    }, 0);
    subtotal = parseFloat(subtotal.toFixed(2));

    // --- AUTOMATIC FREE-SHIPPING COUPON LOGIC ---
    let currentCouponCode = session?.appliedCouponCode;

    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
        if (!currentCouponCode) {
            await prisma.shoppingCartSession.update({
                where: { id: sessionId },
                data: { appliedCouponCode: FREE_SHIPPING_COUPON_CODE },
            });
            currentCouponCode = FREE_SHIPPING_COUPON_CODE;
        }
    } else if (currentCouponCode === FREE_SHIPPING_COUPON_CODE) {
        await prisma.shoppingCartSession.update({
            where: { id: sessionId },
            data: { appliedCouponCode: null },
        });
        currentCouponCode = null;
    }

    let discountAmount = 0;
    let appliedCouponData = undefined;

    if (currentCouponCode) {
        const discount = await prisma.discount.findUnique({
            where: { couponCode: currentCouponCode },
        });

        if (discount && discount.isActive) {
            appliedCouponData = {
                code: discount.couponCode!,
                type: discount.type,
                value: Number(discount.value),
            };

            if (discount.type === 'FIXED_AMOUNT') {
                discountAmount = Number(discount.value);
            } else if (discount.type === 'PERCENTAGE') {
                discountAmount = (subtotal * Number(discount.value)) / 100;
            }
            // FREE_SHIPPING keeps discountAmount 0 (shipping is priced at checkout);
            // the frontend reads appliedCoupon to render "Free Shipping".
        }
    }

    const total = Math.max(0, subtotal - discountAmount);
    const amountLeft = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const itemCount = processedItems.reduce((acc, item) => acc + item.quantity, 0);

    return {
        cartSessionId: sessionId,
        items: processedItems,
        summary: {
            subtotal,
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            itemCount,
            freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
            amountLeftForFreeShipping: parseFloat(amountLeft.toFixed(2)),
            appliedCoupon: appliedCouponData,
        },
    };
}

// ----------------------------- mutations -----------------------------

/**
 * Adds a line (or increments an existing one) and returns the updated cart.
 * Failure kinds signal the controller which 400 message to send.
 */
export async function addItem(
    sessionId: string,
    variantId: string,
    quantity: number,
): Promise<AddItemResult> {
    const existingItem = await prisma.shoppingCartItem.findUnique({
        where: { cartSessionId_variantId: { cartSessionId: sessionId, variantId } },
    });

    if (existingItem) {
        const newLineQty = existingItem.quantity + quantity;
        if (newLineQty > MAX_LINE_QUANTITY) return { kind: 'line_quantity_cap' };

        await prisma.shoppingCartItem.update({
            where: { id: existingItem.id },
            data: { quantity: { increment: quantity } },
        });
    } else {
        const lineCount = await prisma.shoppingCartItem.count({
            where: { cartSessionId: sessionId },
        });
        if (lineCount >= MAX_CART_LINES) return { kind: 'line_count_cap' };

        await prisma.shoppingCartItem.create({
            data: { cartSessionId: sessionId, variantId, quantity },
        });
    }

    const cart = await buildCartObject(sessionId);
    return { kind: 'added', cart };
}

/** Sets a line's quantity; quantity < 1 removes the line. Returns the updated cart. */
export async function updateItemQuantity(
    sessionId: string,
    cartItemId: string,
    quantity: number,
): Promise<CartObject> {
    if (quantity < 1) {
        await prisma.shoppingCartItem.deleteMany({
            where: { id: cartItemId, cartSessionId: sessionId },
        });
    } else {
        await prisma.shoppingCartItem.updateMany({
            where: { id: cartItemId, cartSessionId: sessionId },
            data: { quantity },
        });
    }
    return buildCartObject(sessionId);
}

/** Removes a line owned by the session. Returns the updated cart. */
export async function removeItem(sessionId: string, cartItemId: string): Promise<CartObject> {
    await prisma.shoppingCartItem.deleteMany({
        where: { id: cartItemId, cartSessionId: sessionId },
    });
    return buildCartObject(sessionId);
}