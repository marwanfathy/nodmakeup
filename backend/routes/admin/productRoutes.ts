import express from 'express';
const router = express.Router();

// Import all the distinct functions
import {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    archiveProduct,
    unarchiveProduct,
    deleteProduct,
} from '../../controllers/admin/productController';
import { protect } from '../../middleware/authMiddleware';
import requireValidId, { protectIfToken } from '../../middleware/requireValidId';

// Route for getting all products and creating a new one
router.route('/')
    .get(protect, getProducts)
    .post(protect, createProduct);

// Specific route for archiving (soft delete)
router.route('/:id/archive')
    .put(protect, archiveProduct);

// Specific route for unarchiving
router.route('/:id/unarchive')
    .put(protect, unarchiveProduct);

// Routes for a single product: get, update (main info), and delete (permanent)
router.route('/:id')
    .get(requireValidId, protectIfToken, getProductById)
    .put(requireValidId, protect, updateProduct)
    .delete(requireValidId, protect, deleteProduct); // DELETE verb now correctly maps to the hard delete function

export default router;