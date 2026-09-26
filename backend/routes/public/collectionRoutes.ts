import express from 'express';
const router = express.Router();

import { getCollectionBySlug, getPublicCollections } from '../../controllers/public/collectionController';

// Public list of published collections (fallback for unauthenticated visits)
router.route('/')
    .get(getPublicCollections);

// GET a single collection by its slug
router.route('/:slug')
    .get(getCollectionBySlug);

export default router;