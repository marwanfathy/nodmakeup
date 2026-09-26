import { z } from 'zod';
import { normalizeEgyptPhone } from '../utils/phone';

// Egyptian mobile: +(20) + 10/11/12/15 + 8 digits
const egyptMobile = /^\+?20(10|11|12|15)[0-9]{8}$/;

export const phoneSchema = z
    .string()
    .min(11, 'Phone number must be at least 11 digits.')
    .max(18, 'Phone number is too long.')
    .regex(/(1)[0-9]{8,}/, 'Enter a valid Egyptian mobile number (e.g. 01012345678).');

export const normalizedPhoneSchema = phoneSchema.transform((v) => normalizeEgyptPhone(v));

export const checkoutKeySchema = z
    .string()
    .uuid('checkoutKey must be a UUID (v4).')
    .optional();

export const createOrderSchema = z.object({
    customerName: z.string().trim().min(1, 'Full name is required.').max(200),
    customerPhone: normalizedPhoneSchema,
    customerAddress: z.string().trim().min(1, 'Shipping address is required.').max(255),
    shippingGovernorate: z.string().trim().min(1, 'Shipping governorate is required.').max(100),
    customerNotes: z.string().trim().max(2000, 'Notes must be under 2000 characters.').optional(),
    couponCode: z
        .string()
        .trim()
        .toUpperCase()
        .min(1)
        .max(50)
        .optional()
        .or(z.literal('').transform(() => undefined)),
    checkoutKey: z.string().uuid('checkoutKey must be a UUID.').optional(),
});

export const addCartItemSchema = z.object({
    variantId: z.string().uuid('Invalid variant ID.'),
    quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).int().min(1, 'Quantity must be at least 1.').max(99, 'Maximum 99 units per line.'),
});

export const updateCartItemSchema = z.object({
    quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).int().max(99, 'Maximum 99 units per line.'),
});

export const validateCouponSchema = z.object({
    couponCode: z.string().trim().min(1, 'Coupon code is required.').max(50),
    customerPhone: phoneSchema.optional(),
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email.'),
    password: z.string().min(1, 'Password is required.').max(128),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type LoginInput = z.infer<typeof loginSchema>;