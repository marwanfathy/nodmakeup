import express from 'express';
const router = express.Router();

import { 
    createCollection, 
    getCollections, 
    getCollectionById, 
    updateCollection, 
    deleteCollection 
} from '../../controllers/admin/collectionController';

// --- FIX #1: Only import 'protect' ---
import { protect } from '../../middleware/authMiddleware';
import requireValidId, { protectIfToken } from '../../middleware/requireValidId';
// The 'authorize' function and 'AdminRole' enum are no longer needed.

// --- FIX #2: Remove all calls to 'authorize' ---
router.route('/')
    .post(protect, createCollection)
    .get(protectIfToken, getCollections);

router.route('/:id')
    .get(requireValidId, protectIfToken, getCollectionById)
    .put(requireValidId, protect, updateCollection)
    .delete(requireValidId, protect, deleteCollection);

export default router;