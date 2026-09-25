import express from 'express';
const router = express.Router();

// Import the upgraded controller functions
import { loginAdmin, refreshAdmin, logoutAdmin, getMe } from '../../controllers/admin/authController';

// Import the upgraded middleware
import { protect } from '../../middleware/authMiddleware';
import { validate } from '../../middleware/validate';
import { loginSchema } from '@nod/shared/dist/schemas';

router.post('/login', validate(loginSchema), loginAdmin);
router.post('/refresh', refreshAdmin);
router.post('/logout', logoutAdmin);
router.get('/me', protect, getMe);

export default router;