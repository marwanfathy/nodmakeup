import prisma from '../config/prismaClient';
import { DiscountType } from '@prisma/client';

/**
 * CORE LOGIC: Generates a manual reward coupon controlled by Admin.
 */
export const createPersonalizedReward = async (
    phone: string, 
    name: string,
    type: DiscountType, 
    value: number       
): Promise<string> => {
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `GIFT-${suffix}`;

    const newDiscount = await prisma.discount.create({
        data: {
            name: `Reward for ${name}`,
            couponCode: code,
            type: type,
            value: value,
            isActive: true,
            maxUsages: 1,           
            currentUsages: 0,
            assignedPhone: phone,   
            category: "CLIENT_REWARD" 
        },
    });

    return newDiscount.couponCode || code;
};

/**
 * SPECIFIC FOR AUTOMATED WHATSAPP FLOW:
 * This is the function called by sendOrderThankYouWithReward
 */
export const createPostOrderDiscount = async (phone: string, name: string): Promise<string> => {
    // You can change these defaults (e.g., FIXED amount of 50, or PERCENTAGE of 10)
    const DEFAULT_TYPE = DiscountType.PERCENTAGE; 
    const DEFAULT_VALUE = 10; 

    return await createPersonalizedReward(phone, name, DEFAULT_TYPE, DEFAULT_VALUE);
};