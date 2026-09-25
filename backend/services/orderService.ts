// Order service — public checkout domain.
// Owns the place-order transaction (idempotency, stock reservation, coupon
// claim, order snapshot, CRM sync, outbox record) and the order-detail
// projection used by the storefront confirmation page.
import prisma from '../config/prismaClient';
import { DiscountType, Prisma, TransactionStatus } from '@prisma/client';
import { buildCartObject, CartObject as Cart } from './cartService';
import { recordOutboxEvent, enqueueOutboxEvent } from './outbox';
import { syncCustomerProfileFromOrder } from './customerProfile';
import { emitAnalyticsEvent } from '../realtime/analyticsSse';
import { logger } from '../config/logger';

// ----------------------------- types -----------------------------

export const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidOrderId = (orderId: string): boolean => ORDER_ID_RE.test(orderId);

export interface CreateOrderInput {
    sessionId: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    shippingGovernorate: string;
    customerNotes?: string;
    couponCode?: string;
    checkoutKey?: string;
    requestId?: string;
}

export type CreateOrderResult =
    | { kind: 'placed'; orderId: string; orderNumber: string }
    | { kind: 'already_placed'; orderId: string; orderNumber: string }
    | { kind: 'error'; status: number; message: string };

export interface PublicOrderDetails {
    orderId: string;
    orderNumber: string;
    orderDate: Date;
    status: string;
    payment: { method: string; status: TransactionStatus | null };
    summary: {
        totalPrice: Prisma.Decimal;
        shippingCost: Prisma.Decimal;
        totalDiscount: Prisma.Decimal;
    };
    items: Array<{
        productName: string;
        quantity: number;
        price: Prisma.Decimal;
        color: string | null;
        size: string | null;
        imageUrl: string | null;
    }>;
}

/** Domain failure carrying the HTTP status the controller must respond with. */
class CheckoutFailure extends Error {
    constructor(
        message: string,
        readonly status: number = 500,
    ) {
        super(message);
        this.name = 'CheckoutFailure';
    }
}

interface OrderTotals {
    shippingCost: number;
    couponDiscountAmount: number;
    totalDiscount: number;
    totalPrice: number;
    appliedCouponId: string | null;
    finalSubtotal: number;
    originalSubtotal: number;
    productDiscountAmount: number;
    discountName?: string;
}

// ----------------------------- helpers -----------------------------

const determineInitialStatus = (): { orderStatusName: string; transactionStatus: TransactionStatus } => ({
    orderStatusName: 'Pending Payment',
    transactionStatus: TransactionStatus.Pending,
});

const calculateOrderTotals = async (
    tx: Prisma.TransactionClient,
    cart: Cart,
    shippingGovernorate: string,
    couponCode?: string,
): Promise<OrderTotals> => {
    const shippingZone =
        (await tx.shippingZone.findFirst({ where: { governorate: shippingGovernorate } })) ??
        (await tx.shippingZone.findFirst({ where: { governorate: 'Default' } }));

    if (!shippingZone) throw new CheckoutFailure('Invalid shipping governorate provided.');

    let shippingCost = Number(shippingZone.shippingCost);

    const subtotalWithProductDiscounts = cart.summary.subtotal;
    const originalSubtotal = cart.items.reduce(
        (acc, item) => acc + item.originalPrice * item.quantity,
        0,
    );
    const productDiscountAmount = originalSubtotal - subtotalWithProductDiscounts;

    let couponDiscountAmount = 0;
    let appliedCouponId: string | null = null;
    let discountName: string | undefined = undefined;

    if (couponCode) {
        const coupon = await tx.discount.findFirst({ where: { couponCode, isActive: true } });
        if (!coupon) throw new CheckoutFailure(`Coupon "${couponCode}" is not valid or has expired.`);

        if (coupon.maxUsages > 0 && coupon.currentUsages >= coupon.maxUsages) {
            throw new CheckoutFailure(`This coupon code (${couponCode}) has already been used.`);
        }

        appliedCouponId = coupon.id;
        discountName = coupon.name;

        switch (coupon.type) {
            case DiscountType.FIXED_AMOUNT:
                couponDiscountAmount = Number(coupon.value);
                break;
            case DiscountType.PERCENTAGE:
                couponDiscountAmount = subtotalWithProductDiscounts * (Number(coupon.value) / 100);
                break;
            case DiscountType.FREE_SHIPPING:
                couponDiscountAmount = shippingCost;
                shippingCost = 0;
                break;
        }
    }

    const isFreeShipping =
        appliedCouponId &&
        (await tx.discount.findUnique({ where: { id: appliedCouponId } }))?.type === 'FREE_SHIPPING';
    const subtotalForCalc = subtotalWithProductDiscounts - (isFreeShipping ? 0 : couponDiscountAmount);

    const totalDiscount = productDiscountAmount + couponDiscountAmount;
    const totalPrice = subtotalForCalc + shippingCost;

    return {
        shippingCost,
        couponDiscountAmount,
        totalDiscount,
        totalPrice,
        appliedCouponId,
        finalSubtotal: subtotalWithProductDiscounts,
        originalSubtotal,
        productDiscountAmount,
        discountName,
    };
};

// ----------------------------- use cases -----------------------------

/**
 * Places an order from the caller's cart in a single transaction:
 * idempotency key -> stock reservation -> coupon claim -> order snapshot ->
 * CRM profile sync -> cart clear -> outbox record; then best-effort queue
 * push + realtime analytics after commit.
 */
export async function createOrderFromCart(input: CreateOrderInput): Promise<CreateOrderResult> {
    const {
        sessionId,
        customerName,
        customerPhone,
        customerAddress,
        shippingGovernorate,
        customerNotes,
        couponCode,
        checkoutKey,
        requestId,
    } = input;

    // Idempotency first: retries after a successful (cart-cleared) checkout
    // must return the original order, not "empty cart".
    if (checkoutKey) {
        const existingByKey = await prisma.order.findUnique({
            where: { checkoutKey },
            select: { id: true, orderNumber: true },
        });
        if (existingByKey) {
            return {
                kind: 'already_placed',
                orderId: existingByKey.id,
                orderNumber: existingByKey.orderNumber,
            };
        }
    }

    const cart = await buildCartObject(sessionId);
    if (cart.items.length === 0) {
        return { kind: 'error', status: 400, message: 'Cannot create an order with an empty cart.' };
    }

    try {
        const { order, totals, outboxEventId } = await prisma.$transaction(async (tx) => {
            const { orderStatusName, transactionStatus } = determineInitialStatus();

            const orderStatus = await tx.orderStatus.findFirst({
                where: { statusName: orderStatusName },
                select: { id: true },
            });
            if (!orderStatus) {
                throw new CheckoutFailure(
                    `Order status configuration for "${orderStatusName}" is missing.`,
                );
            }

            const calculatedTotals = await calculateOrderTotals(
                tx,
                cart,
                shippingGovernorate,
                couponCode,
            );
            const order_number = `RGE-${Date.now()}`;

            // 1. Reserve stock atomically — fail fast with 409 if any line is short.
            for (const item of cart.items) {
                const reserve = await tx.productVariant.updateMany({
                    where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
                    data: { stockQuantity: { decrement: item.quantity } },
                });
                if (reserve.count === 0) {
                    throw new CheckoutFailure(`Insufficient stock for SKU ${item.sku}.`, 409);
                }
            }

            // 2. Claim coupon atomically — thundering-herd safe.
            if (calculatedTotals.appliedCouponId) {
                const coupon = await tx.discount.findUnique({
                    where: { id: calculatedTotals.appliedCouponId },
                    select: { maxUsages: true },
                });
                if (coupon && coupon.maxUsages > 0) {
                    const claim = await tx.discount.updateMany({
                        where: {
                            id: calculatedTotals.appliedCouponId,
                            currentUsages: { lt: coupon.maxUsages },
                        },
                        data: { currentUsages: { increment: 1 } },
                    });
                    if (claim.count === 0) {
                        throw new CheckoutFailure(
                            `Coupon "${couponCode}" has reached its maximum usage limit.`,
                            409,
                        );
                    }
                }
            }

            // 3. Create order + items + transaction + applied discount snapshot.
            const createdOrder = await tx.order.create({
                data: {
                    orderNumber: order_number,
                    checkoutKey: checkoutKey ?? null,
                    customerName,
                    customerPhoneNumber: customerPhone,
                    shippingAddressLine1: customerAddress,
                    shippingGovernorate,
                    totalPrice: calculatedTotals.totalPrice,
                    shippingCost: calculatedTotals.shippingCost,
                    totalDiscount: calculatedTotals.totalDiscount,
                    customerNotes,
                    statusId: orderStatus.id,
                    items: {
                        create: cart.items.map((item) => ({
                            variantId: item.variantId,
                            quantity: item.quantity,
                            priceAtPurchase: item.effectiveSalePrice ?? item.originalPrice,
                            productId: item.productId,
                        })),
                    },
                    transactions: {
                        create: {
                            amount: calculatedTotals.totalPrice,
                            status: transactionStatus,
                        },
                    },
                    appliedDiscounts: calculatedTotals.appliedCouponId
                        ? {
                              create: {
                                  discountId: calculatedTotals.appliedCouponId,
                                  amountDeducted: calculatedTotals.couponDiscountAmount,
                              },
                          }
                        : undefined,
                },
            });

            // 4. CRM: upsert / update the customer profile from this order.
            await syncCustomerProfileFromOrder(tx, createdOrder);

            // 5. Clear cart
            await tx.shoppingCartItem.deleteMany({ where: { cartSessionId: sessionId } });

            // 6. Outbox: atomically recorded with the order for at-least-once delivery.
            const outboxEvent = await recordOutboxEvent(tx, 'ORDER_CREATED', createdOrder.id, {
                meta: { requestId: requestId ?? '-' },
                notification: {
                    id: createdOrder.id,
                    orderNumber: createdOrder.orderNumber,
                    customerName: createdOrder.customerName,
                    customerPhoneNumber: createdOrder.customerPhoneNumber,
                    shippingGovernorate: createdOrder.shippingGovernorate,
                    shippingAddress: createdOrder.shippingAddressLine1 ?? '',
                    originalSubtotal: calculatedTotals.originalSubtotal,
                    productDiscount: calculatedTotals.productDiscountAmount,
                    couponDiscount: calculatedTotals.couponDiscountAmount,
                    couponCode,
                    couponName: calculatedTotals.discountName,
                    shippingPrice: calculatedTotals.shippingCost,
                    totalPrice: Number(createdOrder.totalPrice),
                },
            });

            return { order: createdOrder, totals: calculatedTotals, outboxEventId: outboxEvent.id };
        });

        // Post-commit: best-effort push to BullMQ (sweeper heals failures).
        try {
            await enqueueOutboxEvent(outboxEventId, 'ORDER_CREATED');
        } catch (err) {
            logger.error({ err }, 'outbox enqueue failed after order commit (sweeper will retry)');
        }

        // Stream the conversion to the admin realtime feed (admin-only, no PII).
        emitAnalyticsEvent({
            kind: 'purchase',
            orderNumber: order.orderNumber,
            total: Number(order.totalPrice),
            governorate: order.shippingGovernorate,
        });

        return { kind: 'placed', orderId: order.id, orderNumber: order.orderNumber };
    } catch (err) {
        if (err instanceof CheckoutFailure) {
            return { kind: 'error', status: err.status, message: err.message };
        }
        throw err;
    }
}

/** Storefront order-confirmation projection; null when the order doesn't exist. */
export async function getPublicOrderDetails(
    orderId: string,
): Promise<PublicOrderDetails | null> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true,
            orderNumber: true,
            totalPrice: true,
            shippingCost: true,
            totalDiscount: true,
            createdAt: true,
            status: { select: { statusName: true } },
            transactions: {
                take: 1,
                orderBy: { transactionDate: 'desc' },
                select: { status: true },
            },
            items: {
                select: {
                    quantity: true,
                    priceAtPurchase: true,
                    variant: {
                        select: {
                            colorName: true,
                            size: true,
                            images: {
                                take: 1,
                                orderBy: { displayOrder: 'asc' },
                                select: { imageUrl: true },
                            },
                        },
                    },
                    product: { select: { name: true } },
                },
            },
        },
    });

    if (!order) return null;

    return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        status: order.status.statusName,
        payment: {
            method: 'Cash on Delivery',
            status: order.transactions[0]?.status ?? null,
        },
        summary: {
            totalPrice: order.totalPrice,
            shippingCost: order.shippingCost,
            totalDiscount: order.totalDiscount,
        },
        items: order.items.map((item) => ({
            productName: item.product.name,
            quantity: item.quantity,
            price: item.priceAtPurchase,
            color: item.variant.colorName,
            size: item.variant.size,
            imageUrl: item.variant.images[0]?.imageUrl ?? null,
        })),
    };
}