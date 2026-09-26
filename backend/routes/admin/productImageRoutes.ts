import express from 'express';
const router = express.Router();

// 1. Import all three required controller functions
import {
    addProductImage,
    updateProductImage,
    deleteProductImage,
} from '../../controllers/admin/productImageController';

// 2. Only import 'protect' as the role-based 'admin' middleware is gone
import { protect } from '../../middleware/authMiddleware';

// Route for base endpoint: /api/admin/product-images
router.route('/')
    // POST: Add a new image to a product
    .post(protect, addProductImage);

// Route for specific image ID: /api/admin/product-images/:id
router.route('/:id')
    // PUT: Update an existing image's details (e.g., displayOrder)
    .put(protect, updateProductImage)
    
    // DELETE: Remove an image from a product
    .delete(protect, deleteProductImage);

export default router;