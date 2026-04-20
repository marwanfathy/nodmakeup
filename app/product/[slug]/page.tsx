'use client';

import React, { useState, useEffect, FC } from 'react';
import { useParams, useRouter } from 'next/navigation';
// CHANGE 1: Import Skeleton instead of CircularProgress
import { Skeleton } from '@mui/material'; 
import { toast } from 'react-toastify';
import { 
    getProductBySlug, 
    fetchRelatedProducts, 
    ProductDetail, 
    ProductVariantDetail, 
    ProductSummary 
} from '../../../lib/api';
import { useCart } from '../../contexts/CartContext';
import ProductImageGallery from '../../ProductImageGallery/ProductImageGallery';
import VariantSelector from '../../VariantSelector/VariantSelector';
import RelatedProductsSlider from '../../RelatedProducts/RelatedProducts';
import './ProductViewPage.css';

const ProductViewPage: FC = () => {
    const params = useParams();
    const router = useRouter();
    const { addItemToCart } = useCart();
    const slug = params.slug as string;

    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariantDetail | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [quantity, setQuantity] = useState<number>(1);

    const [relatedProducts, setRelatedProducts] = useState<ProductSummary[]>([]);
    const [loadingRelated, setLoadingRelated] = useState<boolean>(true);

    // 1. Fetch Main Product
    useEffect(() => {
        if (!slug) return;
        const fetchProductData = async () => {
            setLoading(true);
            setError(null);
            try {
                const productData = await getProductBySlug(slug);
                if (!productData?.variants?.length) {
                    throw new Error("This product is currently unavailable.");
                }
                setProduct(productData);
                setSelectedVariant(productData.variants[0]);
            } catch (err: any) {
                setError(err.response?.data?.message || err.message || 'Product could not be loaded.');
            } finally {
                setLoading(false);
            }
        };
        fetchProductData();
    }, [slug]);

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

    const handleAddToCart = async () => {
        if (!selectedVariant) return toast.error("Please select a variant.");
        setIsProcessing(true);
        await addItemToCart(selectedVariant.id, quantity);
        setIsProcessing(false);
    };

    const handleBuyNow = async () => {
        if (!selectedVariant) return toast.error("Please select a variant.");
        setIsProcessing(true);
        try {
            const success = await addItemToCart(selectedVariant.id, quantity, { openCart: false });
            if (success) router.push('/checkout');
        } catch (error) {
            toast.error("Could not proceed to checkout.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- CHANGE 2: SKELETON LOADING STATE ---
    // Instead of a spinner, we return the structure of the page with Skeleton components
    if (loading) {
        return (
            <div className="product-page-wrapper">
                <div className="product-grid-container">
                    
                    {/* Left Column Skeleton (Images) */}
                    <div className="product-gallery-section">
                        {/* Main Image */}
                        <Skeleton variant="rectangular" width="100%" height={500} style={{ borderRadius: '8px' }} />
                        {/* Thumbnails */}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} variant="rectangular" width={80} height={80} style={{ borderRadius: '4px' }} />
                            ))}
                        </div>
                    </div>

                    {/* Right Column Skeleton (Details) */}
                    <div className="product-info-section">
                        <div className="sticky-wrapper">
                            {/* Brand */}
                            <Skeleton variant="text" width="30%" height={30} style={{ marginBottom: '10px' }} />
                            {/* Title */}
                            <Skeleton variant="text" width="80%" height={60} style={{ marginBottom: '20px' }} />
                            {/* Price */}
                            <Skeleton variant="text" width="40%" height={40} style={{ marginBottom: '30px' }} />
                            
                            {/* Variant Selectors */}
                            <div style={{ marginBottom: '20px' }}>
                                <Skeleton variant="text" width="20%" style={{ marginBottom: '10px' }} />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Skeleton variant="circular" width={40} height={40} />
                                    <Skeleton variant="circular" width={40} height={40} />
                                    <Skeleton variant="circular" width={40} height={40} />
                                </div>
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '15px', marginTop: '40px' }}>
                                <Skeleton variant="rectangular" width={200} height={50} style={{ borderRadius: '25px' }} />
                                <Skeleton variant="rectangular" width={150} height={50} style={{ borderRadius: '25px' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) return <div className="error-center">{error}</div>;
    if (!product || !selectedVariant) return <div className="error-center">Product data incomplete.</div>;

    const isOutOfStock = selectedVariant.stockQuantity <= 0;
    const isLowStock = selectedVariant.stockQuantity > 0 && selectedVariant.stockQuantity < 5;
    const hasSale = typeof selectedVariant.effectiveSalePrice === 'number' && selectedVariant.effectiveSalePrice < selectedVariant.price;
    const galleryImages = selectedVariant.images || [];

    return (
        <div className="product-page-wrapper">
            <div className="product-grid-container">
                
                {/* --- LEFT COLUMN: IMAGES --- */}
                <div className="product-gallery-section">
                    <ProductImageGallery images={galleryImages} productName={product.name} />
                </div>

                {/* --- RIGHT COLUMN: DETAILS (Sticky) --- */}
                <div className="product-info-section">
                    <div className="sticky-wrapper">
                        
                        {/* 1. Header & Price */}
                        <div className="product-header">
                            <span className="product-brand">{product.brand?.name || 'KIKO MILANO'}</span>
                            <h1 className="product-title">{product.name}</h1>
                            
                            <div className="price-block">
                                {hasSale ? (
                                    <>
                                        <span className="price-current sale">EGP {selectedVariant.effectiveSalePrice!.toFixed(2)}</span>
                                        <span className="price-original">EGP {selectedVariant.price.toFixed(2)}</span>
                                        <span className="price-discount-tag">
                                            {Math.round(((selectedVariant.price - selectedVariant.effectiveSalePrice!) / selectedVariant.price) * 100)}% OFF
                                        </span>
                                    </>
                                ) : (
                                    <span className="price-current">EGP {selectedVariant.price.toFixed(2)}</span>
                                )}
                            </div>
                        </div>

                        {/* 2. Selectors */}
                        <div className="product-selectors">
                            <VariantSelector 
                                product={product}
                                selectedVariant={selectedVariant}
                                onVariantSelect={setSelectedVariant}
                            />

                            {/* Quantity */}
                            <div className="quantity-wrapper">
                                <span className="label">Quantity</span>
                                <div className="qty-control">
                                    <button onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1 || isOutOfStock}>−</button>
                                    <span>{quantity}</span>
                                    <button onClick={() => handleQuantityChange(1)} disabled={quantity >= selectedVariant.stockQuantity || isOutOfStock}>+</button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Actions */}
                        <div className="product-actions">
                            {isOutOfStock ? (
                                <button className="btn-main disabled" disabled>Out of Stock</button>
                            ) : (
                                <>
                                    <button className="btn-main" onClick={handleAddToCart} disabled={isProcessing}>
                                        {isProcessing ? 'Adding...' : 'Add to Shopping Bag'}
                                    </button>
                                    <button className="btn-outline" onClick={handleBuyNow} disabled={isProcessing}>
                                        Buy Now
                                    </button>
                                </>
                            )}
                        </div>


                        {/* 5. Description */}
                        <div className="product-description-container">
                            <h3 className="desc-heading">Product Details</h3>
                            <div className="desc-content" dangerouslySetInnerHTML={{ __html: product.description || '' }} />
                        </div>

                    </div>
                </div>
            </div>

            {/* --- RELATED PRODUCTS SLIDER --- */}
            <div className="related-products-section" style={{ marginTop: '4rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
                <RelatedProductsSlider 
                    products={relatedProducts} 
                    isLoading={loadingRelated} 
                />
            </div>

        </div>
    );
};

export default ProductViewPage;