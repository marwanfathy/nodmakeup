import express from 'express';
const router = express.Router();
import {
    createHeroSection,
    getHeroSections,
    getHeroSectionById,
    updateHeroSection,
    deleteHeroSection
} from '../../controllers/admin/heroSectionController';
import { protect } from '../../middleware/authMiddleware';
import { protectIfToken } from '../../middleware/requireValidId';
import requireValidId from '../../middleware/requireValidId';

// Reads fall through to the public router when no token is present;
// mutations always require an authenticated admin.
router.route('/').post(protect, createHeroSection).get(protectIfToken, getHeroSections);
router.route('/:id')
    .get(requireValidId, protectIfToken, getHeroSectionById)
    .put(requireValidId, protect, updateHeroSection)
    .delete(requireValidId, protect, deleteHeroSection);

export default router;