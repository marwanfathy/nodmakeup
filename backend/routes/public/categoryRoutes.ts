import express from 'express';
const router = express.Router();

import { getAllPublicCategories } from '../../controllers/public/categoryController';

// GET all publicly visible categories
router.route('/')
    .get(getAllPublicCategories);

export default router;