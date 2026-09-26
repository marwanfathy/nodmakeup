// Public media: long-lived cache headers + path validation. express.static
// confines lookups under its root and rejects `..` traversal. Note the
// staging dir (public/temp) is deliberately NOT mounted — raw uploads are
// private until they are processed.
import { Router } from 'express';
import express from 'express';
import { UPLOADS_DIR, THUMBNAILS_DIR } from '../services/storage.js';

const CACHE = { maxAge: '1d', etag: true }; // parity with the legacy static mount

const router = Router();

router.use('/uploads', express.static(UPLOADS_DIR, CACHE));
router.use('/thumbnails', express.static(THUMBNAILS_DIR, CACHE));

export default router;