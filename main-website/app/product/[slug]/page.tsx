import { getProductBySlug } from '@/lib/api';
import ProductViewPage from './ProductViewPage';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const fallback = { title: 'Product | NOD Makeup' };
    try {
        const product = await getProductBySlug(slug);
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

export default function ProductRoute({ params }: { params: Promise<{ slug: string }> }) {
    return <ProductViewPage />;
}