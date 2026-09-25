import express from 'express';
const router = express.Router();

import { getShippingZones } from '../../controllers/public/shippingController';

// GET all publicly available shipping zones
router.route('/')
    .get(getShippingZones);

export default router;