"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertLandingLayoutSchema = exports.upsertLandingBannerSchema = exports.loginSchema = exports.validateCouponSchema = exports.updateCartItemSchema = exports.addCartItemSchema = exports.trackOrderSchema = exports.createOrderSchema = exports.checkoutKeySchema = exports.normalizedPhoneSchema = exports.phoneSchema = void 0;
const zod_1 = require("zod");
const phone_1 = require("../utils/phone");
const sections_1 = require("../landing/sections");
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
/**
 * Public tracking lookup. The order number is stored upper-case (`RGE-…`) and
 * is the only field. Kept in shared so the storefront form and the API handler
 * refuse the same input for the same reason.
 */
exports.trackOrderSchema = zod_1.z.object({
    orderNumber: zod_1.z
        .string()
        .trim()
        .min(1, 'Order number is required.')
        .max(50, 'Order number is too long.')
        .transform((v) => v.toUpperCase()),
});
exports.addCartItemSchema = zod_1.z.object({
    variantId: zod_1.z.string().uuid('Invalid variant ID.'),
    quantity: zod_1.z.coerce.number().int({ message: 'Quantity must be a number.' }).int().min(1, 'Quantity must be at least 1.').max(99, 'Maximum 99 units per line.'),
});
exports.updateCartItemSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number().int({ message: 'Quantity must be a number.' }).int().max(99, 'Maximum 99 units per line.'),
});
exports.validateCouponSchema = zod_1.z.object({
    couponCode: zod_1.z.string().trim().min(1, 'Coupon code is required.').max(50),
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
    customerPhone: zod_1.z
        .string()
        .trim()
        .refine((v) => v === '' || exports.phoneSchema.safeParse(v).success, {
        message: 'Enter a valid Egyptian mobile number (e.g. 01012345678).',
    })
        .optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email('Enter a valid email.'),
    password: zod_1.z.string().min(1, 'Password is required.').max(128),
});
// --- landing banner ------------------------------------------------------
const requiredText = (max, label) => zod_1.z
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
const optionalText = (max, label) => zod_1.z
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
const internalPathSchema = zod_1.z
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
const mediaPathSchema = zod_1.z
    .string()
    .trim()
    .min(1, 'Banner image is required.')
    .max(255)
    .refine((v) => !SCHEME_RE.test(v) || /^https?:\/\//i.test(v), {
    message: 'Image must be an uploaded media path or an http(s) URL.',
});
exports.upsertLandingBannerSchema = zod_1.z.object({
    imageUrl: mediaPathSchema,
    imageAlt: optionalText(255, 'Image alt text'),
    tagline: requiredText(120, 'Tagline'),
    taglineAr: optionalText(120, 'Arabic tagline'),
    title: requiredText(120, 'Title'),
    titleAr: optionalText(120, 'Arabic title'),
    ctaLabel: requiredText(60, 'Button label'),
    ctaLabelAr: optionalText(60, 'Arabic button label'),
    ctaUrl: internalPathSchema,
    isActive: zod_1.z.boolean(),
});
// --- landing layout ------------------------------------------------------
// The hero's carousel slug, validated against the registry's single definition
// of the shape (SECTION_SLUG_RE) so the schema, the admin read and the public
// read cannot disagree about what counts as a slug.
const heroSlugSchema = zod_1.z
    .string()
    .trim()
    .min(1, 'Hero slug is required.')
    .max(64)
    .regex(sections_1.SECTION_SLUG_RE, 'Hero slug may contain lower-case letters, digits and single dashes.');
/**
 * One section's entry in a layout write.
 *
 * A single object with cross-field rules rather than a discriminated union: the
 * rules are "the key must be registered" and "hero settings belong to the hero
 * section", which is a relationship between fields, not a shape difference. A
 * union would repeat the whole object per section, and discriminatedUnion cannot
 * key off a refined `z.string()` anyway.
 */
const landingSectionSchema = zod_1.z
    .object({
    key: zod_1.z.string().trim().min(1).max(64),
    isEnabled: zod_1.z.boolean(),
    heroMode: zod_1.z.string().trim().min(1).max(32).optional(),
    heroSlug: heroSlugSchema.optional(),
})
    .superRefine((section, ctx) => {
    const problem = (path, message) => ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: [path], message });
    if (!(0, sections_1.isLandingSectionKey)(section.key)) {
        problem('key', 'Unknown landing section.');
        return;
    }
    // Hero settings on a section that declares no modes at all. Storing them
    // would be invisible here and confusing everywhere else: a row carrying a
    // slug or mode the storefront never reads. Checked against `hasModes`
    // rather than the chosen mode, so a slug saved before its mode is picked
    // is still accepted.
    if (!(0, sections_1.hasModes)(section.key)) {
        if (section.heroMode !== undefined)
            problem('heroMode', 'This section has no modes to set.');
        if (section.heroSlug !== undefined)
            problem('heroSlug', 'This section has no modes to set.');
        return;
    }
    // The value has to be one of THAT section's modes — checked against the
    // registry, so a section gaining modes later needs no edit here.
    if (section.heroMode !== undefined && !(0, sections_1.isModeFor)(section.key, section.heroMode)) {
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
exports.upsertLandingLayoutSchema = zod_1.z.object({
    sections: zod_1.z
        .array(landingSectionSchema)
        .max(sections_1.LANDING_SECTIONS.length + 5, 'Too many sections in one layout.')
        .refine((sections) => new Set(sections.map((s) => s.key)).size === sections.length, { message: 'A section may appear only once in the layout.' }),
});
