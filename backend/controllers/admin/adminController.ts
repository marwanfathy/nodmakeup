import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as adminUsers from '../../services/adminUserService';
import { call } from './domainCall';

const ADMIN_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @desc      Create a new Admin user
 * @route     POST /api/v1/users/admins
 * @access    Private
 */
const createAdmin = asyncHandler(async (req: Request, res: Response) => {
    const performingAdminId = req.admin?.admin_id;
    if (!performingAdminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
        res.status(400);
        throw new Error('Please provide all required fields');
    }

    const data = await call(res, () => adminUsers.createAdminUser({ performingAdminId, firstName, lastName, email, password }));

    res.status(201).json({ message: 'Admin user created', data });
});

/**
 * @desc      Get all Admin users
 * @route     GET /api/v1/users/admins
 * @access    Private
 */
const getAdmins = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await adminUsers.listAdminUsers());
});

/**
 * @desc      DELETE an Admin user (hard delete)
 * @route     DELETE /api/v1/users/admins/:id
 * @access    Private
 */
const deleteAdmin = asyncHandler(async (req: Request, res: Response) => {
    const performingAdminId = req.admin?.admin_id;
    if (!performingAdminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const adminIdToDelete = req.params.id;
    if (!ADMIN_ID_RE.test(adminIdToDelete)) {
        res.status(400);
        throw new Error('Invalid admin ID');
    }

    await call(res, () => adminUsers.deleteAdminUser({ performingAdminId, adminIdToDelete }));

    res.status(200).json({ message: 'Admin user deleted' });
});

export { createAdmin, getAdmins, deleteAdmin };