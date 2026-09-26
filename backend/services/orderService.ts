// Order service — public checkout domain.
// Owns the place-order transaction (idempotency, stock reservation, coupon
// claim, order snapshot, CRM sync, outbox record) and the order-detail
// projection used by the storefront confirmation page.
import prisma from '../config/prismaClient';
import { DiscountType, Prisma, TransactionStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
        productNameAr: string | null;
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

/**
 * How many times to re-run the place-order transaction when the generated
 * order number collides. `orderNumber` is @unique, and the old scheme was
 * `RGE-${Date.now()}` — millisecond resolution, so any two checkouts landing
 * in the same millisecond collided. That is not a theoretical window: the
 * project's own flash-sale load test (deploy/loadtest/flash-sale.js) fires 100
 * simultaneous checkouts at a 5-unit SKU, which makes same-millisecond
 * collisions likely, and the loser got a bare 500 from the Prisma error
 * middleware instead of an order.
 */
const ORDER_NUMBER_ATTEMPTS = 4;

const isUniqueViolation = (err: unknown): boolean =>
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Which unique constraint a P2002 names, e.g. 'orderNumber' or 'checkoutKey'. */
const uniqueTarget = (err: unknown): string => {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return '';
    const target = (err.meta as { target?: unknown } | undefined)?.target;
    if (Array.isArray(target)) return target.join(',');
    return typeof target === 'string' ? target : '';
};

/**
 * Human-facing order number: a base-36 timestamp so it sorts chronologically
 * and reads as a date, plus a slice of the order's own pre-generated UUID for
 * entropy. Deriving the suffix from the primary key rather than a counter means
 * there is no shared sequence to contend on, and a repeat would require the
 * same UUID twice.
 */
const buildOrderNumber = (orderId: string): string => {
    const stamp = Date.now().toString(36).toUpperCase();
    return `RGE-${stamp}-${orderId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
};

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
    let couponIsFreeShipping = false;

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
                couponIsFreeShipping = true;
                break;
        }
    }

    // Was a second `discount.findUnique` to re-ask whether the coupon was the
    // FREE_SHIPPING kind the switch statement above had already established.
    // One extra round trip inside the checkout transaction, per checkout, to
    // recompute a value already in hand.
    const subtotalForCalc = subtotalWithProductDiscounts - (couponIsFreeShipping ? 0 : couponDiscountAmount);

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
 *
 * Wrapped in a bounded retry because two @unique columns on `orders` can be
 * lost to a race, and both used to surface as an opaque 500:
 *
 *  - `checkoutKey`: the pre-flight lookup below happens outside the
 *    transaction, so two concurrent retries of the *same* request both see
 *    "no such order" and both proceed. The loser's INSERT violates the unique
 *    index and rolls its whole transaction back — stock is correctly restored,
 *    so this was never a double-charge — but the customer got a 500 for a
 *    request that had in fact already succeeded. It now resolves to the
 *    original order.
 *  - `orderNumber`: same-millisecond collision, now practically impossible
 *    given the uuid-derived suffix, and retried regardless.
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

    for (let attempt = 1; attempt <= ORDER_NUMBER_ATTEMPTS; attempt += 1) {
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

        // Minted up front so the order number can be derived from the primary
        // key. Two attempts therefore never share a number by construction.
        const orderId = randomUUID();

        try {
            const { order, outboxEventId } = await prisma.$transaction(async (tx) => {
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
                        id: orderId,
                        orderNumber: buildOrderNumber(orderId),
                        checkoutKey: checkoutKey ?? null,
                        // Proof of ownership for the public confirmation read.
                        cartSessionId: sessionId,
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

                // 4. Clear cart
                await tx.shoppingCartItem.deleteMany({ where: { cartSessionId: sessionId } });

                // 5. Outbox: atomically recorded with the order for at-least-once delivery.
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

                return { order: createdOrder, outboxEventId: outboxEvent.id };
            });

            // Post-commit: best-effort push to BullMQ (sweeper heals failures).
            try {
                await enqueueOutboxEvent(outboxEventId, 'ORDER_CREATED');
            } catch (err) {
                logger.error({ err }, 'outbox enqueue failed after order commit (sweeper will retry)');
            }

            // Post-commit: CRM segmentation counters.
            //
            // Outside the transaction on purpose, and non-fatal on purpose. The
            // profile is derived reporting data; nothing about the order depends
            // on it, so it must never be able to fail a checkout. Running it in
            // its own transaction is also what makes its own race handling work
            // — see the long note on syncCustomerProfileFromOrder.
            try {
                await syncCustomerProfileFromOrder(order);
            } catch (err) {
                logger.error(
                    { err, orderId: order.id },
                    'customer profile sync failed (order committed; segmentation may under-count until rebuild)',
                );
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

            if (isUniqueViolation(err)) {
                const target = uniqueTarget(err);
                // Another request with this same idempotency key won the race.
                // Its order is the answer to this one.
                if (target.includes('checkoutKey') && checkoutKey) {
                    const existing = await prisma.order.findUnique({
                        where: { checkoutKey },
                        select: { id: true, orderNumber: true },
                    });
                    if (existing) {
                        return {
                            kind: 'already_placed',
                            orderId: existing.id,
                            orderNumber: existing.orderNumber,
                        };
                    }
                }
                // A number collision is not the caller's problem and not
                // retry-visible: re-run with a freshly minted id.
                if (attempt < ORDER_NUMBER_ATTEMPTS) {
                    logger.warn(
                        { err, target, attempt },
                        'unique constraint collision placing order; retrying',
                    );
                    continue;
                }
            }

            throw err;
        }
    }

    // Unreachable: the loop either returns or throws on its final attempt.
    return { kind: 'error', status: 500, message: 'Could not place the order. Please try again.' };
}

/**
 * Storefront order-confirmation projection.
 *
 * `sessionId` is the caller's anonymous cart session and is REQUIRED. This
 * endpoint hands back the customer's name, phone number and street address, and
 * the only thing standing between that PII and anyone who has the order UUID
 * used to be the unguessability of a v4 UUID — which is not a control, because
 * the id travels in the URL and therefore leaks through browser history,
 * referrer headers, analytics and proxy logs. Worse, the same projection is
 * mounted on the admin router behind `protectIfToken`
 * (routes/admin/orderRoutes.ts), which deliberately falls through to the public
 * handler when no token is present, so it was reachable with no auth at all.
 *
 * A session with no matching order is reported as "not found" rather than
 * "forbidden", so this cannot be used to probe which order ids exist.
 */
export async function getPublicOrderDetails(
    orderId: string,
    sessionId: string,
): Promise<PublicOrderDetails | null> {
    const order = await prisma.order.findFirst({
        where: { id: orderId, cartSessionId: sessionId },
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
                    product: { select: { name: true, nameAr: true } },
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
            productNameAr: item.product.nameAr,
            quantity: item.quantity,
            price: item.priceAtPurchase,
            color: item.variant.colorName,
            size: item.variant.size,
            imageUrl: item.variant.images[0]?.imageUrl ?? null,
        })),
    };
}