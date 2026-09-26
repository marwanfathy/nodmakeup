import { getProductBySlug, type ProductDetail } from '@/lib/api';
import { serverGetProductBySlug } from '@/lib/server-api';
import ProductViewPage from './ProductViewPage';

// The product used to be fetched twice for a single page view: once here for the
// <title>/description, and again inside ProductViewPage's effect once the
// browser had hydrated. Both hit the same uncached endpoint, so every PDP visit
// cost two API round trips and two database reads.
//
// It is now fetched once, on the server, through lib/server-api.ts. Two things
// follow from that:
//
//   * the Data Cache serves generateMetadata and the page body from the same
//     entry, so the second read is free — they share a cache key;
//   * the product arrives as part of the HTML, so the page can be painted before
//     any JavaScript runs.
//
// The client fetch is kept as a fallback for when the server read fails, so a
// transient API error degrades to the old behaviour instead of an error page.

async function loadProduct(slug: string): Promise<ProductDetail | null> {
    const cached = await serverGetProductBySlug(slug);
    if (cached) return cached as ProductDetail;

    // The cached read failed (API down, or the slug genuinely 404s). Try the
    // direct client so a cold cache is not the same as a broken page.
    try {
        return await getProductBySlug(slug);
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const fallback = { title: 'Product | NOD Makeup' };
    try {
        const product = await loadProduct(slug);
        if (!product) return fallback;
        return {
            title: `${product.name} | NOD Makeup`,
            description:
                product.description?.replace(/<[^>]*>/g, '').slice(0, 160) ||
                `Shop ${product.name} at NOD Makeup.`,
        };
    } catch {
        return fallback;
    }
}

export default async function ProductRoute({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const product = await loadProduct(slug);

    return <ProductViewPage initialProduct={product} />;
}
