import express from 'express';
const router = express.Router();

import {
    getCrmOverview,
    getSegments,
    getCustomers,
    getCustomerById,
    updateCustomer,
    addCustomerNote,
    backfillCustomers,
} from '../../controllers/admin/crmController';

import { protect } from '../../middleware/authMiddleware';

// Static paths before parameterized ones (Express matches in order).
router.route('/overview').get(protect, getCrmOverview);
router.route('/segments').get(protect, getSegments);
router.route('/backfill').post(protect, backfillCustomers);

router.route('/customers')
    .get(protect, getCustomers);

router.route('/customers/:customerId')
    .get(protect, getCustomerById)
    .put(protect, updateCustomer);

router.route('/customers/:customerId/notes')
    .post(protect, addCustomerNote);

export default router;