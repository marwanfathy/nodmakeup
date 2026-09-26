import { z } from 'zod';
export declare const phoneSchema: z.ZodString;
export declare const normalizedPhoneSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const checkoutKeySchema: z.ZodOptional<z.ZodString>;
export declare const createOrderSchema: z.ZodObject<{
    customerName: z.ZodString;
    customerPhone: z.ZodEffects<z.ZodString, string, string>;
    customerAddress: z.ZodString;
    shippingGovernorate: z.ZodString;
    customerNotes: z.ZodOptional<z.ZodString>;
    couponCode: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">]>;
    checkoutKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    customerPhone: string;
    customerName: string;
    customerAddress: string;
    shippingGovernorate: string;
    couponCode?: string | undefined;
    customerNotes?: string | undefined;
    checkoutKey?: string | undefined;
}, {
    customerPhone: string;
    customerName: string;
    customerAddress: string;
    shippingGovernorate: string;
    couponCode?: string | undefined;
    customerNotes?: string | undefined;
    checkoutKey?: string | undefined;
}>;
export declare const addCartItemSchema: z.ZodObject<{
    variantId: z.ZodString;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    variantId: string;
    quantity: number;
}, {
    variantId: string;
    quantity: number;
}>;
export declare const updateCartItemSchema: z.ZodObject<{
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    quantity: number;
}, {
    quantity: number;
}>;
export declare const validateCouponSchema: z.ZodObject<{
    couponCode: z.ZodString;
    customerPhone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    couponCode: string;
    customerPhone?: string | undefined;
}, {
    couponCode: string;
    customerPhone?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
