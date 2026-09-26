import express from 'express';
import asyncHandler from 'express-async-handler';
const router = express.Router();

// --- FIX #1: Import the correct function name ---
import { 
    createCategory, 
    getCategories, 
    getCategoryById, 
    updateCategory, 
    deleteCategory // Changed from archiveCategory
} from '../../controllers/admin/categoryController';

import { getAllPublicCategories } from '../../controllers/public/categoryController';

// --- FIX #2: Only import 'protect' ---
import { protect } from '../../middleware/authMiddleware';
import requireValidId from '../../middleware/requireValidId';
// The 'authorize' function and 'AdminRole' enum are no longer needed.

// --- FIX #3: Remove all calls to 'authorize' ---
router.route('/')
    .post(protect, createCategory)
    .get(function (req, res, next) {
        // Public view of categories falls through WITHOUT auth (?public=true)
        if (req.query.public === 'true') return next();
        return protect(req, res, next);
    }, asyncHandler(async (req, res, next) => {
        if (req.query.public === 'true') {
            await getAllPublicCategories(req, res, next);
            return;
        }
        await getCategories(req, res, next);
    }));

router.route('/:id')
    .get(requireValidId, protect, getCategoryById)
    .put(requireValidId, protect, updateCategory)
    .delete(requireValidId, protect, deleteCategory); // Use the correct function name here

export default router;