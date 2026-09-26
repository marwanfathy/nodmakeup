"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.validateCouponSchema = exports.updateCartItemSchema = exports.addCartItemSchema = exports.createOrderSchema = exports.checkoutKeySchema = exports.normalizedPhoneSchema = exports.phoneSchema = void 0;
const zod_1 = require("zod");
const phone_1 = require("../utils/phone");
// Egyptian mobile: +(20) + 10/11/12/15 + 8 digits
const egyptMobile = /^\+?20(10|11|12|15)[0-9]{8}$/;
exports.phoneSchema = zod_1.z
    .string()
    .min(11, 'Phone number must be at least 11 digits.')
    .max(18, 'Phone number is too long.')
    .regex(/(1)[0-9]{8,}/, 'Enter a valid Egyptian mobile number (e.g. 01012345678).');
exports.normalizedPhoneSchema = exports.phoneSchema.transform((v) => (0, phone_1.normalizeEgyptPhone)(v));
exports.checkoutKeySchema = zod_1.z
    .string()
    .uuid('checkoutKey must be a UUID (v4).')
    .optional();
exports.createOrderSchema = zod_1.z.object({
    customerName: zod_1.z.string().trim().min(1, 'Full name is required.').max(200),
    customerPhone: exports.normalizedPhoneSchema,
    customerAddress: zod_1.z.string().trim().min(1, 'Shipping address is required.').max(255),
    shippingGovernorate: zod_1.z.string().trim().min(1, 'Shipping governorate is required.').max(100),
    customerNotes: zod_1.z.string().trim().max(2000, 'Notes must be under 2000 characters.').optional(),
    couponCode: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .min(1)
        .max(50)
        .optional()
        .or(zod_1.z.literal('').transform(() => undefined)),
    checkoutKey: zod_1.z.string().uuid('checkoutKey must be a UUID.').optional(),
});
exports.addCartItemSchema = zod_1.z.object({
    variantId: zod_1.z.string().uuid('Invalid variant ID.'),
    quantity: zod_1.z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).int().min(1, 'Quantity must be at least 1.').max(99, 'Maximum 99 units per line.'),
});
exports.updateCartItemSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).int().max(99, 'Maximum 99 units per line.'),
});
exports.validateCouponSchema = zod_1.z.object({
    couponCode: zod_1.z.string().trim().min(1, 'Coupon code is required.').max(50),
    customerPhone: exports.phoneSchema.optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email('Enter a valid email.'),
    password: zod_1.z.string().min(1, 'Password is required.').max(128),
});
