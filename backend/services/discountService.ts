// Discount service — storefront coupon validation.
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';
import type { CouponRejectionReason } from '@nod/shared';

export interface ValidatedCoupon {
    discountId: string;
    name: string;
    discountType: string;
    value: Prisma.Decimal;
    isPersonalized: boolean;
}

/**
 * A refusal, carrying a machine-readable `reason` beside the prose `message`.
 *
 * The reason is what the storefront acts on. `message` stays for logs and for any
 * caller with no better option, but it is English-only: the storefront used to
 * show it verbatim, so an Arabic shopper was told their personal coupon was
 * refused in a language they had not chosen. The client now maps `reason` to its
 * own wording, and every refusal says what to do next rather than only what went
 * wrong — "reserved for another customer" on its own is a dead end.
 */
export type CouponValidationResult =
    | { ok: true; discount: ValidatedCoupon }
    | {
          ok: false;
          status: 400 | 403 | 404;
          reason: CouponRejectionReason;
          message: string;
      };

/**
 * Validates an active coupon: existence, usage cap and (for personalized
 * codes) phone ownership. Failure carries the HTTP status + message so the
 * controller can respond verbatim.
 */
export async function validateCouponCode(
    couponCode: string,
    customerPhone: unknown,
): Promise<CouponValidationResult> {
    const discount = await prisma.discount.findFirst({
        where: { couponCode, isActive: true },
        select: {
            id: true,
            name: true,
            type: true,
            value: true,
            maxUsages: true,
            currentUsages: true,
            assignedPhone: true,
        },
    });

    if (!discount) {
        return {
            ok: false,
            status: 404,
            reason: 'NOT_FOUND',
            message: `Coupon "${couponCode}" is not valid or has expired.`,
        };
    }

    if (discount.maxUsages > 0 && discount.currentUsages >= discount.maxUsages) {
        return {
            ok: false,
            status: 400,
            reason: 'LIMIT_REACHED',
            message: 'This coupon has reached its maximum usage limit.',
        };
    }

    if (discount.assignedPhone) {
        const phoneProvided = typeof customerPhone === 'string' && customerPhone.trim() !== '';
        if (!phoneProvided) {
            return {
                ok: false,
                status: 400,
                reason: 'PERSONALIZED_NEEDS_PHONE',
                message: 'This is a personalized coupon. Please provide your phone number to use it.',
            };
        }

        // Normalize digits (handles "2010..." vs "010..." country-code drift).
        const dbPhone = discount.assignedPhone.replace(/\D/g, '');
        const inputPhone = customerPhone.replace(/\D/g, '');
        const isMatch = dbPhone.includes(inputPhone) || inputPhone.includes(dbPhone);

        if (!isMatch) {
            return {
                ok: false,
                status: 403,
                reason: 'NOT_OWNED',
                message: 'This coupon is reserved for a specific customer.',
            };
        }
    }

    return {
        ok: true,
        discount: {
            discountId: discount.id,
            name: discount.name,
            discountType: discount.type,
            value: discount.value,
            isPersonalized: !!discount.assignedPhone,
        },
    };
}