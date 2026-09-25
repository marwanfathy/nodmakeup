import express from 'express';
const router = express.Router();

import { getDashboardStats } from '../../controllers/admin/dashboardController';
import { protect } from '../../middleware/authMiddleware';

// Use the correct enum values from your schema
router.route('/')
    .get(protect, getDashboardStats);

export default router;