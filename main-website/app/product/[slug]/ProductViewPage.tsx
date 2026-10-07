'use client';

import React, { useState, useEffect, useRef, FC } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    getProductBySlug, 
    fetchRelatedProducts, 
    ProductDetail, 
    ProductVariantDetail, 
    ProductSummary 
} from '../../../lib/api';
import { useCart } from '../../../contexts/CartContext';
import ProductImageGallery from '../../../components/product/ProductImageGallery/ProductImageGallery';
import VariantSelector from '../../../components/product/VariantSelector/VariantSelector';
import RelatedProductsSlider from '../../../components/product/RelatedProducts/RelatedProducts';
import { useI18n } from '../../../lib/i18n/client';
import { localePath } from '../../../lib/i18n/paths';
import { formatPrice, pickLocale } from '../../../lib/format';
import './ProductViewPage.css';

interface ProductViewPageProps {
    /**
     * The product, already resolved on the server by app/product/[slug]/page.tsx.
     * `null` (or absent) falls back to fetching in the browser, as before.
     */
    initialProduct?: ProductDetail | null;
}

const ProductViewPage: FC<ProductViewPageProps> = ({ initialProduct = null }) => {
    const params = useParams();
    const router = useRouter();
    const { addItemToCart, mutationError, dismissMutationError } = useCart();
    const { locale, t } = useI18n();
    const slug = params.slug as string;

    // True when the server already resolved this product. A product that came
    // back is usable straight away, so the page never has to wait on a fetch it
    // does not need — but a server read that failed (or found nothing) still
    // falls through to the browser fetch below.
    const resolvedOnServer = initialProduct !== null && !!initialProduct?.variants?.length;

    const [product, setProduct] = useState<ProductDetail | null>(initialProduct);
    // Only wait when there is genuinely nothing to show yet.
    const [loading, setLoading] = useState<boolean>(!resolvedOnServer);
    const [error, setError] = useState<string | null>(null);
    // Pre-select the first variant, exactly as the fetch path does, so the
    // server-rendered markup and the hydrated markup agree.
    const [selectedVariant, setSelectedVariant] = useState<ProductVariantDetail | null>(
        resolvedOnServer ? initialProduct!.variants[0] : null
    );
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [quantity, setQuantity] = useState<number>(1);

    // A refusal from the API, held by the cart context. It is shown under the
    // buy buttons rather than in a popup, because the shopper is looking at
    // those buttons and the fix is to press one of them again — quite possibly
    // with a different quantity or variant, which the message stays up for.
    const addError = mutationError?.action === 'add' ? mutationError.message : null;

    // Changing the variant is also an answer to a previous refusal, so the
    // message is spent the moment a different one is chosen. Without this it
    // outlives its cause and sits under the buttons over a product that is now
    // perfectly buyable.
    const handleVariantSelect = (variant: ProductVariantDetail) => {
        setSelectedVariant(variant);
        dismissMutationError();
    };

    const [relatedProducts, setRelatedProducts] = useState<ProductSummary[]>([]);
    const [loadingRelated, setLoadingRelated] = useState<boolean>(true);

    // 3. Floating mobile CTA
    // The in-page actions are the source of truth: while they sit off-screen the
    // bar floats at the bottom of the viewport, and as soon as the user scrolls
    // to that section it hands off to them (no duplicate-looking buttons).
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const [showFloatingCta, setShowFloatingCta] = useState<boolean>(false);

    useEffect(() => {
        const el = actionsRef.current;
        if (!el) return;
        // Negative bottom margin: swap the bar out slightly before the real CTA
        // lands, so the two never appear at once mid-scroll.
        const observer = new IntersectionObserver(
            ([entry]) => setShowFloatingCta(!entry.isIntersecting),
            { rootMargin: '0px 0px -72px 0px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [product, selectedVariant]);

    // 4. Height of the fixed navbar
    // The navbar is `position: fixed` and its height comes from the logo image
    // (which shrinks on narrow screens), so it cannot be hardcoded. Measuring
    // it and publishing it as --nav-h keeps the page clear of the bar and stops
    // the sticky details panel from sliding underneath it.
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [navHeight, setNavHeight] = useState<number>(0);

    useEffect(() => {
        // `.navbar-wrapper` is the rule that used to hold the header's background
        // and its fixed positioning — but the navbar component never renders it,
        // it emits a bare <header> around `.navbar`. Querying the dead class meant
        // this returned early on every page load, --nav-h kept its 80px fallback,
        // and a header that is genuinely shorter than that left a gap of dead
        // space above the gallery. Measured from the header that actually exists.
        const nav = document.querySelector<HTMLElement>('.navbar');
        if (!nav) return;
        const publish = () => setNavHeight(nav.getBoundingClientRect().height);
        publish();
        // The logo has no intrinsic CSS height, so watch the element rather than
        // the viewport: a resize, a font swap or a route change can all move it.
        const observer = new ResizeObserver(publish);
        observer.observe(nav);
        window.addEventListener('resize', publish);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', publish);
        };
    }, []);

    // 1. Fetch Main Product
    useEffect(() => {
        if (!slug) return;
        if (resolvedOnServer) return;
        const fetchProductData = async () => {
            setLoading(true);
            setError(null);
            try {
                const productData = await getProductBySlug(slug);
                if (!productData?.variants?.length) {
                    throw new Error(t('pdp.unavailable'));
                }
                setProduct(productData);
                setSelectedVariant(productData.variants[0]);
            } catch (err: unknown) {
                const status =
                  err && typeof err === 'object' && 'response' in err
                    ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                    : undefined;
                setError(status || (err instanceof Error ? err.message : t('pdp.loadError')));
            } finally {
                setLoading(false);
            }
        };
        fetchProductData();
        // resolvedOnServer is in the deps because a client-side navigation to a
        // different product delivers a different `initialProduct` prop: the new
        // one may be null (server read failed), and this effect is what retries.
    }, [slug, resolvedOnServer]);

    // 2. Fetch Related Products
    useEffect(() => {
        const loadRelated = async () => {
            if (!product?.id) return;
            setLoadingRelated(true);
            try {
                const data = await fetchRelatedProducts(product.id.toString());
                setRelatedProducts(data);
            } catch (error) {
                console.error("Error loading related products", error);
            } finally {
                setLoadingRelated(false);
            }
        };

        if (product) {
            loadRelated();
        }
    }, [product]);

    const handleQuantityChange = (delta: number) => {
        if (!selectedVariant) return;
        setQuantity(prev => {
            const newVal = prev + delta;
            if (newVal < 1) return 1;
            if (newVal > selectedVariant.stockQuantity) return selectedVariant.stockQuantity;
            return newVal;
        });
    };

    // Both buy buttons share this one guard. It is a type narrowing rather than
    // a real branch: the render below bails out with `pdp.dataIncomplete` when
    // there is no selected variant, so these buttons are never on screen without
    // one. (They used to pop a "please select a variant" toast that could not
    // fire, which is the same dead code wearing a notification.)
    const handleAddToCart = async () => {
        if (!selectedVariant) return;
        setIsProcessing(true);
        await addItemToCart(selectedVariant.id, quantity);
        setIsProcessing(false);
    };

    const handleBuyNow = async () => {
        if (!selectedVariant) return;
        setIsProcessing(true);
        // `addItemToCart` reports its own refusal through the context rather
        // than by throwing, so the message under the buttons covers this path
        // too and there is nothing to catch here.
        const success = await addItemToCart(selectedVariant.id, quantity, { openCart: false });
        if (success) router.push(localePath('/checkout', locale));
        setIsProcessing(false);
    };

    // --- SKELETON LOADING STATE ---
    // The real page's own classes, in the same order, with placeholder blocks
    // where its content goes. That is what makes this responsive for free: the
    // rules that collapse .product-grid-container to one column, unstick
    // .sticky-wrapper and stack .product-actions on a phone are the same rules
    // the real page uses, so the skeleton is already a phone layout on a phone.
    // Nothing carries a fixed pixel width — a 200px + 150px button row inside a
    // 355px-wide column used to force a sideways scroll while loading.
    // aria-hidden because the text it stands in for is not written yet.
    if (loading) {
        return (
            <div className="product-page-wrapper" ref={wrapperRef} style={navHeight ? ({ '--nav-h': `${navHeight}px` } as React.CSSProperties) : undefined}>
                <div className="product-grid-container" aria-busy="true" aria-live="polite">
                    <div className="product-gallery-section" aria-hidden="true">
                        {/* Main image placeholder — sized like .main-image-container */}
                        <div className="pdp-skeleton pdp-skeleton--media" />
                        {/* Thumbnails — .thumbnail-container lays these out for us */}
                        <div className="thumbnail-container">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="pdp-skeleton pdp-skeleton--thumb" />
                            ))}
                        </div>
                    </div>

                    <div className="product-info-section">
                        <div className="sticky-wrapper" aria-hidden="true">
                            <nav className="breadcrumbs">
                                <span className="pdp-skeleton pdp-skeleton--line" style={{ width: 56, height: 12 }} />
                                <span className="breadcrumbs-sep">/</span>
                                <span className="pdp-skeleton pdp-skeleton--line" style={{ width: 76, height: 12 }} />
                                <span className="breadcrumbs-sep">/</span>
                                <span className="pdp-skeleton pdp-skeleton--line" style={{ width: 96, height: 12 }} />
                            </nav>

                            <div className="product-header">
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: 92, height: 11, marginBottom: 12 }} />
                                <h1 className="product-title pdp-skeleton pdp-skeleton--line" style={{ height: 40 }} />
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: '70%', height: 15, marginTop: 10 }} />
                                <div className="price-block">
                                    <div className="pdp-skeleton pdp-skeleton--line" style={{ width: 120, height: 30 }} />
                                </div>
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: 92, height: 11, marginTop: 12 }} />
                            </div>

                            {/* Colour swatches */}
                            <div className="product-selectors">
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: 72, height: 11, marginBottom: 10 }} />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {[0, 1, 2, 3].map((i) => (
                                        <div key={i} className="pdp-skeleton pdp-skeleton--dot" />
                                    ))}
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="quantity-wrapper">
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: 64, height: 11, marginBottom: 10 }} />
                                <div className="pdp-skeleton pdp-skeleton--btn" style={{ width: 132, height: 44 }} />
                            </div>

                            {/* Buttons — .product-actions is a column of full-width
                                pills in the real layout, so this stacks too. */}
                            <div className="product-actions">
                                <div className="pdp-skeleton pdp-skeleton--btn" />
                                <div className="pdp-skeleton pdp-skeleton--btn" />
                            </div>

                            <ul className="trust-signals">
                                {[64, 76, 60].map((w, i) => (
                                    <li key={i} style={{ paddingLeft: 0 }}>
                                        <div className="pdp-skeleton pdp-skeleton--line" style={{ width: w, height: 11 }} />
                                    </li>
                                ))}
                            </ul>

                            <div className="product-description-container">
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: 80, height: 16, marginBottom: 14 }} />
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: '100%', height: 11, marginBottom: 9 }} />
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: '92%', height: 11, marginBottom: 9 }} />
                                <div className="pdp-skeleton pdp-skeleton--line" style={{ width: '64%', height: 11 }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) return <div className="error-center">{error}</div>;
    if (!product || !selectedVariant) return <div className="error-center">{t('pdp.dataIncomplete')}</div>;

    const localized = pickLocale(product, locale);
    const isOutOfStock = selectedVariant.stockQuantity <= 0;
    const isLowStock = selectedVariant.stockQuantity > 0 && selectedVariant.stockQuantity < 5;
    const hasSale = typeof selectedVariant.effectiveSalePrice === 'number' && selectedVariant.effectiveSalePrice < selectedVariant.price;
    const galleryImages = selectedVariant.images || [];

    return (
        <div
            className={`product-page-wrapper ${showFloatingCta ? 'has-floating-cta' : ''}`}
            ref={wrapperRef}
            style={navHeight ? ({ '--nav-h': `${navHeight}px` } as React.CSSProperties) : undefined}
        >
            <div className="product-grid-container">

                {/* --- LEFT COLUMN: IMAGES --- */}
                <div className="product-gallery-section">
                    <ProductImageGallery images={galleryImages} productName={localized.name} />
                </div>

                {/* --- RIGHT COLUMN: DETAILS (Sticky) --- */}
                <div className="product-info-section">
                    <div className="sticky-wrapper">

                        {/* 0. Breadcrumbs — orientation, and the path search engines read */}
                        <nav className="breadcrumbs" aria-label={t('pdp.details')}>
                            <Link href={localePath('/', locale)}>{t('pdp.home')}</Link>
                            {product.category ? (
                                <>
                                    <span className="breadcrumbs-sep" aria-hidden="true">/</span>
                                    <Link href={localePath(`/shop?category=${product.category.id}`, locale)}>
                                        {product.category.name}
                                    </Link>
                                </>
                            ) : null}
                            <span className="breadcrumbs-sep" aria-hidden="true">/</span>
                            <span className="breadcrumbs-current" aria-current="page">
                                {localized.name}
                            </span>
                        </nav>

                        {/* 1. Header & Price */}
                        <div className="product-header">
                            {product.brand?.name ? (
                                <span className="product-brand">{product.brand.name}</span>
                            ) : null}
                            <h1 className="product-title">{localized.name}</h1>

                            {/* The one-line pitch belongs directly under the price, where
                                it answers "what is this" before the shopper has to
                                commit to reading the long description. */}
                            {localized.shortDescription ? (
                                <p className="product-subtitle">{localized.shortDescription}</p>
                            ) : null}

                            <div className="price-block">
                                {hasSale ? (
                                    <>
                                        <span className="price-current sale">{formatPrice(selectedVariant.effectiveSalePrice!, locale)}</span>
                                        <span className="price-original">{formatPrice(selectedVariant.price, locale)}</span>
                                        <span className="price-discount-tag">
                                            {t('pdp.off', { percent: Math.round(((selectedVariant.price - selectedVariant.effectiveSalePrice!) / selectedVariant.price) * 100) })}
                                        </span>
                                    </>
                                ) : (
                                    <span className="price-current">{formatPrice(selectedVariant.price, locale)}</span>
                                )}
                            </div>

                            {/* Scarcity, stated plainly. Announced politely because it
                                changes when a shopper picks a different variant. */}
                            <p className="stock-line" aria-live="polite">
                                {isOutOfStock ? null : isLowStock ? (
                                    <span className="stock-warning">{t('pdp.onlyLeft', { count: selectedVariant.stockQuantity })}</span>
                                ) : (
                                    <span className="stock-ok">{t('pdp.inStock')}</span>
                                )}
                            </p>
                        </div>
                        {/* 2. Selectors */}
                        <div className="product-selectors">
                            <VariantSelector 
                                product={product}
                                selectedVariant={selectedVariant}
                                onVariantSelect={handleVariantSelect}
                            />

                            {/* Quantity */}
                            <div className="quantity-wrapper">
                                <span className="label">{t('pdp.quantity')}</span>
                                <div className="qty-control">
                                    <button
                                        onClick={() => handleQuantityChange(-1)}
                                        disabled={quantity <= 1 || isOutOfStock}
                                        aria-label={t('pdp.decreaseQty')}
                                    >
                                        −
                                    </button>
                                    <span aria-live="polite">{quantity}</span>
                                    <button
                                        onClick={() => handleQuantityChange(1)}
                                        disabled={quantity >= selectedVariant.stockQuantity || isOutOfStock}
                                        aria-label={t('pdp.increaseQty')}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Actions — also the anchor the floating CTA hands off to */}
                        <div className="product-actions" ref={actionsRef}>
                            {isOutOfStock ? (
                                <button className="btn-main disabled" disabled>{t('pdp.outOfStock')}</button>
                            ) : (
                                <>
                                    <button className="btn-main" data-track="add_to_cart" onClick={handleAddToCart} disabled={isProcessing}>
                                        {isProcessing ? t('pdp.adding') : t('pdp.addToBag')}
                                    </button>
                                    <button className="btn-outline" data-track="buy_now" onClick={handleBuyNow} disabled={isProcessing}>
                                        {t('pdp.buyNow')}
                                    </button>
                                </>
                            )}
                            {/* A refusal from the API belongs to the buttons, not to
                                the swatches: it is fixed by pressing one of them
                                again, possibly with a different quantity. */}
                            {addError && (
                                <p className="pdp-action-error" role="alert">{addError}</p>
                            )}
                        </div>

                        {/* 4. Reassurance, directly under the decision. Replaces the
                            old "trust-signals" stylesheet, which had no markup. */}
                        <ul className="trust-signals">
                            <li>{t('pdp.trustAuthentic')}</li>
                            <li>{t('pdp.trustDelivery')}</li>
                            <li>{t('pdp.trustReturns')}</li>
                        </ul>

                        {/* 5. The long description comes last: it is reference material,
                            and putting it above the buy button pushed the CTA off screen. */}
                        {localized.description ? (
                            <div className="product-description-container">
                                <h3 className="desc-heading">{t('pdp.details')}</h3>
                                <div className="desc-content" dangerouslySetInnerHTML={{ __html: localized.description }} />
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* --- RELATED PRODUCTS SLIDER --- */}
            <div className="related-products-section">
                <RelatedProductsSlider 
                    products={relatedProducts} 
                    isLoading={loadingRelated} 
                />
            </div>

            {/* --- FLOATING MOBILE CTA ---
                Mobile only (hidden on desktop, where the in-page actions are
                always reachable via .sticky-wrapper). It free-floats while the
                in-page CTA is scrolled out of view and yields to it on arrival. */}
            <div className={`pdp-floating-cta ${showFloatingCta ? 'is-visible' : ''}`}>
                <div className="pdp-floating-cta__price">
                    {hasSale ? (
                        <>
                            <span className="pdp-floating-cta__price-now">
                                {formatPrice(selectedVariant.effectiveSalePrice!, locale)}
                            </span>
                            <span className="pdp-floating-cta__price-was">
                                {formatPrice(selectedVariant.price, locale)}
                            </span>
                        </>
                    ) : (
                        <span className="pdp-floating-cta__price-now">
                            {formatPrice(selectedVariant.price, locale)}
                        </span>
                    )}
                </div>
                <button
                    className="pdp-floating-cta__btn"
                    data-track="add_to_cart_floating"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || isProcessing}
                >
                    {isOutOfStock
                        ? t('pdp.outOfStock')
                        : isProcessing
                            ? t('pdp.adding')
                            : t('pdp.addToBag')}
                </button>
            </div>

        </div>
    );
};

export default ProductViewPage;