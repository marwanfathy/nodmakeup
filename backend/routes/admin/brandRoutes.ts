import express from 'express';
const router = express.Router();

// --- START: FIX ---
// Import the new function name 'deleteBrand' and remove the old one.
import { 
    createBrand, 
    getBrands, 
    getBrandById, 
    updateBrand, 
    deleteBrand 
} from '../../controllers/admin/brandController';
// --- END: FIX ---

import { protect } from '../../middleware/authMiddleware';
// We removed the role system, so the AdminRole import is no longer needed here.

router.route('/')
    .post(protect, createBrand)
    .get(protect, getBrands);

router.route('/:id')
    .get(protect, getBrandById)
    .put(protect, updateBrand)
    // Use the new function name here as well.
    .delete(protect, deleteBrand);

export default router;