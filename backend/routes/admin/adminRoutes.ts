import express from 'express';
const router = express.Router();

// --- START: FIX ---
// Import the new function name 'deleteAdmin' and remove the old one.
import { 
    createAdmin, 
    getAdmins, 
    deleteAdmin 
} from '../../controllers/admin/adminController';
// --- END: FIX ---

import { protect } from '../../middleware/authMiddleware';

router.route('/')
    .post(protect, createAdmin)
    .get(protect, getAdmins);

router.route('/:id')
    // Use the new function name here as well.
    .delete(protect, deleteAdmin);

export default router;