'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from '../ProductCard/ProductCard'; // Adjust path if needed
import { ProductCardSkeleton } from '../ProductCard/ProductCardSkeleton'; // Adjust path if needed
import { 
    searchProducts, 
    getPublicCategories, 
    ProductSummary, 
    Category 
} from '../../lib/api'; 
import './ShopPage.css';

export default function ShopPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // --- State ---
    const [products, setProducts] = useState<ProductSummary[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Filters State ---
    // We default to the URL param 'category' or empty string (All)
    const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || '');
    const [sortBy, setSortBy] = useState<string>('newest');

    // 1. Fetch Categories on Mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const cats = await getPublicCategories();
                setCategories(cats);
            } catch (err) {
                console.error("Failed to load categories", err);
            }
        };
        fetchCategories();
    }, []);

    // 2. Fetch Products when filters change
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            setError(null);
            try {
                // Prepare query params for the API
                const params: any = {
                    sort: sortBy,
                    limit: 50 // Fetch a decent batch
                };

                if (selectedCategory) {
                    params.category = selectedCategory;
                }

                // Call the API
                // Note: Based on your controller, this returns { data: [], pagination: {} }
                const response: any = await searchProducts(params);
                
                // Handle axios response wrapper vs direct data
                const productData = response.data?.data || response.data || [];
                setProducts(productData);

            } catch (err) {
                console.error("Error loading products", err);
                setError("Could not load products. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [selectedCategory, sortBy]);

    // --- Handlers ---
    const handleCategoryClick = (slug: string) => {
        setSelectedCategory(slug);
        // Optional: Update URL without reloading page
        const newUrl = slug ? `/shop?category=${slug}` : '/shop';
        window.history.pushState({}, '', newUrl);
    };

    return (
        <div className="shop-page-container">
            
            {/* --- Header Section --- */}
            <header className="shop-header">
                <h1 className="shop-title">
                    {selectedCategory 
                        ? categories.find(c => c.slug === selectedCategory)?.name 
                        : 'Shop All'}
                </h1>
                
                <div className="shop-controls">
                    {/* Sort Dropdown */}
                    <div className="sort-wrapper">
                        <label htmlFor="sort">Sort by:</label>
                        <select 
                            id="sort" 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value)}
                            className="sort-select"
                        >
                            <option value="newest">Newest Arrivals</option>
                            <option value="name_asc">Name (A-Z)</option>
                            <option value="name_desc">Name (Z-A)</option>
                        </select>
                    </div>
                </div>
            </header>

{/* --- Category Filter Bar --- */}
            <nav className="category-filter-bar">
                <button 
                    className={`cat-pill ${selectedCategory === '' ? 'active' : ''}`}
                    onClick={() => handleCategoryClick('')}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button 
                        // FIX: Use 'cat.slug' instead of 'cat.id' because id might be mismatched
                        key={cat.slug} 
                        className={`cat-pill ${selectedCategory === cat.slug ? 'active' : ''}`}
                        onClick={() => handleCategoryClick(cat.slug)}
                    >
                        {cat.name}
                    </button>
                ))}
            </nav>

            {/* --- Product Grid --- */}
            <main className="shop-grid-wrapper">
                {loading ? (
                    <div className="shop-product-grid">
                        {/* Render 8 skeletons while loading */}
                        {[...Array(8)].map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="shop-error">{error}</div>
                ) : products.length === 0 ? (
                    <div className="shop-empty">
                        <p>No products found in this category.</p>
                        <button onClick={() => setSelectedCategory('')} className="btn-reset">
                            View All Products
                        </button>
                    </div>
                ) : (
                    <div className="shop-product-grid">
                        {products.map((product) => (
                            <div key={product.id} className="shop-card-wrapper">
                                <ProductCard product={product} />
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}