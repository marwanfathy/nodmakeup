// backend/utils/sanitizeHtml.ts
//
// Allowlist HTML sanitizer for product descriptions (the storefront renders
// `description` via dangerouslySetInnerHTML on the product page).
//
// Kept intentionally small + dependency-free: the input is authored by shop
// admins (trusted-ish), so we drop everything outside a safe tag allowlist
// (scripts, styles, comments, event handlers, inline styles, javascript: URLs)
// while preserving basic text formatting. For untrusted/malformed HTML this
// would need a real parser-based sanitizer (sanitize-html) — revisit if the
// surface grows.
//
// Note (deviation from plan): the plan asked for this in `shared/`, but a dep
// or util living in shared would need to resolve from every consuming package's
// node_modules; keeping it backend-local avoids that lockfile ripple and the
// sanitizer is a backend concern (it guards the API payload).

const ALLOWED_TAGS = new Set([
    'a', 'b', 'blockquote', 'br', 'em', 'figcaption', 'figure', 'h1', 'h2',
    'h3', 'h4', 'h5', 'h6', 'i', 'img', 'li', 'ol', 'p', 'span', 'strong', 'ul',
]);

const SAFE_URL_RE = /^(https?:|mailto:|tel:|#|\/)/i;

const ATTR_RE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

function safeAttrValue(key: string, raw: string): string | null {
    const k = key.toLowerCase();
    if (k.startsWith('on')) return null; // event handlers
    if (k === 'style' || k === 'srcdoc') return null; // inline styles / scripts
    let v = raw.trim();
    if (k === 'href' || k === 'src') {
        if (!SAFE_URL_RE.test(v)) return null; // javascript:/data:/vbscript: dropped
        // second pass strips obfuscation (control chars / whitespace inside scheme)
        if (/javascript:|vbscript:|data:/i.test(v.replace(/[\s\x00-\x1f]/g, ''))) return null;
    }
    return `${k}="${v.replace(/"/g, '&quot;')}"`;
}

/** Sanitize an HTML fragment to the allowlist; returns '' for null/empty input. */
export function sanitizeHtml(input: string | null | undefined): string {
    if (!input) return '';

    return input
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\s*(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (full, close, tag, attrs) => {
            const name = tag.toLowerCase();
            if (!ALLOWED_TAGS.has(name)) return ''; // drop unknown tags, keep inner text

            const safe = attrs
                ? Array.from<RegExpMatchArray>(attrs.matchAll(ATTR_RE))
                      .map((m) => safeAttrValue(m[1], m[2] ?? m[3] ?? m[4] ?? ''))
                      .filter((a): a is string => a !== null)
                : [];

            return `<${close}${name}${safe.length ? ` ${safe.join(' ')}` : ''}>`;
        });
}