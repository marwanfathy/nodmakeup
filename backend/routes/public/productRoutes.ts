import express from 'express';
const router = express.Router();

import {
    getProductBySlug,
    getHeroProducts,
    searchProducts,
    getRelatedProducts,
} from '../../controllers/public/productController';

// 1. Static/Specific routes come FIRST
router.get('/search', searchProducts);
router.get('/hero', getHeroProducts);

// 2. FIX: Place this BEFORE the /:slug route
// FIX: Changed path to '/related/:productId' to match your frontend code
router.get('/related/:productId', getRelatedProducts);

// 3. Dynamic route /:slug must be LAST (it acts like a wildcard)
router.get('/:slug', getProductBySlug);

export default router;