import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as productImages from '../../services/adminProductImageService';
import { call } from './domainCall';

/**
 * @desc      Add a new image to a variant
 * @route     POST /api/v1/catalog/product-images
 * @access    Private
 */
export const addProductImage = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const { variantId, imageUrl, altText, displayOrder } = req.body;

    if (!variantId || !imageUrl) {
        res.status(400);
        throw new Error('variantId and imageUrl are required.');
    }

    const newImage = await productImages.addProductImage({ adminId, variantId, imageUrl, altText, displayOrder });

    res.status(201).json({ message: 'Image added successfully', data: newImage });
});

/**
 * @desc      Update an image
 * @route     PUT /api/v1/catalog/product-images/:id
 * @access    Private
 */
export const updateProductImage = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const imageId = req.params.id;
    const { displayOrder, altText, variantId } = req.body;

    const updatedImage = await call(res, () =>
        productImages.updateProductImage({ adminId, imageId, displayOrder, altText, variantId }),
    );

    res.status(200).json({ message: 'Image updated successfully', data: updatedImage });
});

/**
 * @desc      Delete a product image
 * @route     DELETE /api/v1/catalog/product-images/:id
 * @access    Private
 */
export const deleteProductImage = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    await call(res, () => productImages.deleteProductImage({ adminId, imageId: req.params.id }));

    res.status(200).json({ message: 'Image deleted successfully' });
});