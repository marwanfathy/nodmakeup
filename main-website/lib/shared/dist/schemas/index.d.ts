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
    /**
     * Optional, and an EMPTY string is a legitimate value rather than a bad one.
     *
     * The shopper may reach the discount box with no number yet, and "no number"
     * is a state the API has an opinion about: a personal code is refused with
     * PERSONALIZED_NEEDS_PHONE, which the storefront can explain and offer a way
     * out of. Validating `''` against the phone schema turned that answer into a
     * generic "Validation failed." with two field complaints, so the one refusal
     * that needed explaining most was the one that arrived unexplained.
     */
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
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
export declare const upsertLandingBannerSchema: z.ZodObject<{
    imageUrl: z.ZodEffects<z.ZodString, string, string>;
    imageAlt: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    tagline: z.ZodString;
    taglineAr: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    title: z.ZodString;
    titleAr: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    ctaLabel: z.ZodString;
    ctaLabelAr: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    ctaUrl: z.ZodEffects<z.ZodString, string, string>;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    imageUrl: string;
    tagline: string;
    title: string;
    ctaLabel: string;
    ctaUrl: string;
    isActive: boolean;
    imageAlt?: string | undefined;
    taglineAr?: string | undefined;
    titleAr?: string | undefined;
    ctaLabelAr?: string | undefined;
}, {
    imageUrl: string;
    tagline: string;
    title: string;
    ctaLabel: string;
    ctaUrl: string;
    isActive: boolean;
    imageAlt?: string | undefined;
    taglineAr?: string | undefined;
    titleAr?: string | undefined;
    ctaLabelAr?: string | undefined;
}>;
/**
 * The whole homepage layout in one write: order, visibility and per-section
 * settings.
 *
 * Order is the array order — there is no displayOrder field in the body,
 * because a number the client also has to keep consistent with the array is one
 * more thing that can disagree with itself. The service assigns the indices.
 *
 * Capped at the registry size + a little slack: the body is a fixed set of
 * known sections, so an unbounded array is only ever a mistake or an attempt to
 * make the service do unbounded work.
 */
export declare const upsertLandingLayoutSchema: z.ZodObject<{
    sections: z.ZodEffects<z.ZodArray<z.ZodEffects<z.ZodObject<{
        key: z.ZodString;
        isEnabled: z.ZodBoolean;
        heroMode: z.ZodOptional<z.ZodString>;
        heroSlug: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }, {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }>, {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }, {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }>, "many">, {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }[], {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }[]>;
}, "strip", z.ZodTypeAny, {
    sections: {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }[];
}, {
    sections: {
        key: string;
        isEnabled: boolean;
        heroMode?: string | undefined;
        heroSlug?: string | undefined;
    }[];
}>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpsertLandingBannerInput = z.infer<typeof upsertLandingBannerSchema>;
export type UpsertLandingLayoutInput = z.infer<typeof upsertLandingLayoutSchema>;
