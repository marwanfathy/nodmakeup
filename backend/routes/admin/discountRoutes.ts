import express from 'express';
const router = express.Router();

import {
    createDiscount,
    getDiscounts,
    getDiscountById,
    updateDiscount,
    deleteDiscount,
} from '../../controllers/admin/discountController';

import { protect } from '../../middleware/authMiddleware';

router.route('/')
    .post(protect, createDiscount)
    .get(protect, getDiscounts);

router.route('/:id')
    .get(protect, getDiscountById)
    .put(protect, updateDiscount)
    .delete(protect, deleteDiscount);

export default router;