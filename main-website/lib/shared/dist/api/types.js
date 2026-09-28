"use strict";
/**
 * NOD Makeup — shared DTOs.
 *
 * ALL wire types are camelCase. These mirror the storefront shapes and the
 * backend serializers — clients and servers both import from here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCouponRejectionReason = exports.COUPON_REJECTION_REASONS = void 0;
/**
 * Why a coupon was refused, as a code rather than a sentence.
 *
 * The API also sends a human-readable `message`, but prose is the wrong thing for
 * a client to react to: it cannot be translated, and it cannot tell the UI what
 * to do next. A shopper on the Arabic page was shown an English sentence, and a
 * "reserved for another customer" reply gave them nothing to act on.
 *
 * The storefront maps each code to its own wording and to the recovery it
 * implies — a code that needs a phone focuses the phone field rather than
 * re-asking for the code. So the backend decides *what happened* and the client
 * decides *what to say*, in the reader's language.
 */
exports.COUPON_REJECTION_REASONS = [
    /** No such code, or the code belongs to a discount that is no longer active. */
    'NOT_FOUND',
    /** Already used the number of times it allows. */
    'LIMIT_REACHED',
    /** Reserved for one number, and the shopper has not given a phone yet. */
    'PERSONALIZED_NEEDS_PHONE',
    /** Reserved for one number, and the phone given is a different one. */
    'NOT_OWNED',
];
/** Narrows an untrusted value (a response body) to a known rejection reason. */
const isCouponRejectionReason = (value) => typeof value === 'string' && exports.COUPON_REJECTION_REASONS.includes(value);
exports.isCouponRejectionReason = isCouponRejectionReason;
