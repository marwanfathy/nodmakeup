import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as crm from '../../services/crmService';

const CUSTOMER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @desc      CRM overview KPIs
 * @route     GET /api/v1/crm/overview
 * @access    Private
 */
export const getCrmOverview = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await crm.getCrmOverview());
});

/**
 * @desc      Segment breakdown with counts
 * @route     GET /api/v1/crm/segments
 * @access    Private
 */
export const getSegments = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await crm.getSegmentBreakdown());
});

/**
 * @desc      Paginated customer list with search + segment filter
 * @route     GET /api/v1/crm/customers
 * @access    Private
 */
export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 15));

    res.status(200).json(
        await crm.listCustomers({ page, limit, search: req.query.search, segment: req.query.segment }),
    );
});

/**
 * @desc      Full customer record: profile + order history + notes
 * @route     GET /api/v1/crm/customers/:customerId
 * @access    Private
 */
export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.params.customerId;
    if (!CUSTOMER_ID_RE.test(customerId)) {
        res.status(400);
        throw new Error('Invalid Customer ID format');
    }

    const data = await crm.getCustomerDetail(customerId);

    if (!data) {
        res.status(404);
        throw new Error('Customer not found');
    }

    res.status(200).json(data);
});

/**
 * @desc      Update customer profile fields
 * @route     PUT /api/v1/crm/customers/:customerId
 * @access    Private
 */
export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.params.customerId;
    if (!CUSTOMER_ID_RE.test(customerId)) {
        res.status(400);
        throw new Error('Invalid Customer ID format');
    }

    const { name, email, governorate, address, tags, segment } = req.body;

    res.status(200).json(
        await crm.updateCustomerProfile(customerId, { name, email, governorate, address, tags, segment }),
    );
});

/**
 * @desc      Add an internal note to a customer
 * @route     POST /api/v1/crm/customers/:customerId/notes
 * @access    Private
 */
export const addCustomerNote = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.params.customerId;
    if (!CUSTOMER_ID_RE.test(customerId)) {
        res.status(400);
        throw new Error('Invalid Customer ID format');
    }

    const { note } = req.body;
    if (!note || typeof note !== 'string' || !note.trim()) {
        res.status(400);
        throw new Error('Note text is required.');
    }

    res.status(201).json(await crm.addCustomerNote(customerId, note, req.admin?.admin_id));
});

/**
 * @desc      Backfill / recompute profiles from past orders
 * @route     POST /api/v1/crm/backfill
 * @access    Private
 */
export const backfillCustomers = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await crm.backfillCustomerProfiles(req.admin?.admin_id));
});