import { z } from 'zod';
import { normalizeEgyptPhone } from '../utils/phone';
import { hasModes, isLandingSectionKey, isModeFor, LANDING_SECTIONS, SECTION_SLUG_RE } from '../landing/sections';

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
    quantity: z.coerce.number().int({ message: 'Quantity must be a number.' }).int().min(1, 'Quantity must be at least 1.').max(99, 'Maximum 99 units per line.'),
});

export const updateCartItemSchema = z.object({
    quantity: z.coerce.number().int({ message: 'Quantity must be a number.' }).int().max(99, 'Maximum 99 units per line.'),
});

export const validateCouponSchema = z.object({
    couponCode: z.string().trim().min(1, 'Coupon code is required.').max(50),
    customerPhone: phoneSchema.optional(),
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email.'),
    password: z.string().min(1, 'Password is required.').max(128),
});

// --- landing banner ------------------------------------------------------

const requiredText = (max: number, label: string) =>
    z
        .string()
        .trim()
        .min(1, `${label} is required.`)
        .max(max, `${label} must be under ${max} characters.`);

// An Arabic twin of an English string. Optional on purpose: forcing six fields
// to publish one English edit would be a papercut, and the storefront already
// falls back to the English value per string (the rule Product.nameAr uses).
//
// Written as a single schema with a trailing transform rather than the
// `.optional().or(z.literal('').transform(...))` union used for couponCode.
// A union returns whichever branch matches first, and an empty string already
// satisfies the string branch — so the blank-collapses-to-undefined arm was
// unreachable, and "" was persisted instead of null. The transform runs on
// every value, so it actually fires.
const optionalText = (max: number, label: string) =>
    z
        .string()
        .trim()
        .max(max, `${label} must be under ${max} characters.`)
        .optional()
        .transform((v) => (v ? v : undefined));

// An admin-authored value that the storefront renders as a link, so it is held
// to a root-relative site path. Every storefront route is root-relative
// (/shop, /product/slug) and localePath() prefixes the locale itself. Allowing
// an absolute or "//host" value would turn an admin edit into an open redirect,
// and "javascript:" into stored XSS.
const internalPathSchema = z
    .string()
    .trim()
    .min(1, 'Link is required.')
    .max(255)
    .refine((v) => v.startsWith('/') && !v.startsWith('//'), {
        message: 'Link must be a site path starting with / (e.g. /shop).',
    });

// Uploaded media arrives as "uploads/<folder>/<file>" with NO leading slash —
// that is what media-server's relativeUrl() builds, and what the admin panel
// stores, because its rebaseMedia() replaces the absolute URL with the path.
// An http(s) URL is also accepted for a row written by hand. Any other scheme
// is refused, because "javascript:" and "data:" must never reach an <img src>
// out of an operator-supplied field.
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

const mediaPathSchema = z
    .string()
    .trim()
    .min(1, 'Banner image is required.')
    .max(255)
    .refine((v) => !SCHEME_RE.test(v) || /^https?:\/\//i.test(v), {
        message: 'Image must be an uploaded media path or an http(s) URL.',
    });

export const upsertLandingBannerSchema = z.object({
    imageUrl: mediaPathSchema,
    imageAlt: optionalText(255, 'Image alt text'),
    tagline: requiredText(120, 'Tagline'),
    taglineAr: optionalText(120, 'Arabic tagline'),
    title: requiredText(120, 'Title'),
    titleAr: optionalText(120, 'Arabic title'),
    ctaLabel: requiredText(60, 'Button label'),
    ctaLabelAr: optionalText(60, 'Arabic button label'),
    ctaUrl: internalPathSchema,
    isActive: z.boolean(),
});

// --- landing layout ------------------------------------------------------

// The hero's carousel slug, validated against the registry's single definition
// of the shape (SECTION_SLUG_RE) so the schema, the admin read and the public
// read cannot disagree about what counts as a slug.
const heroSlugSchema = z
    .string()
    .trim()
    .min(1, 'Hero slug is required.')
    .max(64)
    .regex(SECTION_SLUG_RE, 'Hero slug may contain lower-case letters, digits and single dashes.');

/**
 * One section's entry in a layout write.
 *
 * A single object with cross-field rules rather than a discriminated union: the
 * rules are "the key must be registered" and "hero settings belong to the hero
 * section", which is a relationship between fields, not a shape difference. A
 * union would repeat the whole object per section, and discriminatedUnion cannot
 * key off a refined `z.string()` anyway.
 */
const landingSectionSchema = z
    .object({
        key: z.string().trim().min(1).max(64),
        isEnabled: z.boolean(),
        heroMode: z.string().trim().min(1).max(32).optional(),
        heroSlug: heroSlugSchema.optional(),
    })
    .superRefine((section, ctx) => {
        const problem = (path: 'key' | 'heroMode' | 'heroSlug', message: string) =>
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

        if (!isLandingSectionKey(section.key)) {
            problem('key', 'Unknown landing section.');
            return;
        }

        // Hero settings on a section that declares no modes at all. Storing them
        // would be invisible here and confusing everywhere else: a row carrying a
        // slug or mode the storefront never reads. Checked against `hasModes`
        // rather than the chosen mode, so a slug saved before its mode is picked
        // is still accepted.
        if (!hasModes(section.key)) {
            if (section.heroMode !== undefined) problem('heroMode', 'This section has no modes to set.');
            if (section.heroSlug !== undefined) problem('heroSlug', 'This section has no modes to set.');
            return;
        }

        // The value has to be one of THAT section's modes — checked against the
        // registry, so a section gaining modes later needs no edit here.
        if (section.heroMode !== undefined && !isModeFor(section.key, section.heroMode)) {
            problem('heroMode', `"${section.heroMode}" is not a mode this section supports.`);
        }
    });

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
export const upsertLandingLayoutSchema = z.object({
    sections: z
        .array(landingSectionSchema)
        .max(LANDING_SECTIONS.length + 5, 'Too many sections in one layout.')
        .refine(
            (sections) => new Set(sections.map((s) => s.key)).size === sections.length,
            { message: 'A section may appear only once in the layout.' },
        ),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpsertLandingBannerInput = z.infer<typeof upsertLandingBannerSchema>;
export type UpsertLandingLayoutInput = z.infer<typeof upsertLandingLayoutSchema>;