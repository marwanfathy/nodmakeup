import type { AppliedDiscount, Cart, OrderCreationData, OrderCreationResponse, OrderDetails, ShippingZone } from '../api/types';
import { type ApiClientOptionsPatch } from './client';
/** Cart domain client (session resource under orders). */
export declare const cartApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    getCart: () => Promise<Cart>;
    addItem: (variantId: string, quantity: number) => Promise<Cart>;
    updateItemQuantity: (cartItemId: string, quantity: number) => Promise<Cart>;
    removeItem: (cartItemId: string) => Promise<Cart>;
};
/** Orders + discounts + shipping zones. */
export declare const ordersApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    createOrder: (data: OrderCreationData) => Promise<OrderCreationResponse>;
    getOrderDetails: (orderId: string) => Promise<OrderDetails>;
    getShippingZones: () => Promise<ShippingZone[]>;
    validateCoupon: (couponCode: string, customerPhone?: string) => Promise<AppliedDiscount>;
};
/** Orders admin client. */
export declare const ordersAdminApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    getAll: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getById: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    getStatuses: () => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    updateStatus: (orderId: string, statusId: string) => Promise<import("axios").AxiosResponse<any, {
        statusId: string;
    }, {}, any>>;
    updateTransactionStatus: (orderId: string, status: string) => Promise<import("axios").AxiosResponse<any, {
        status: string;
    }, {}, any>>;
    sendReward: (orderId: string, discountType: string, discountValue: number | string) => Promise<import("axios").AxiosResponse<any, {
        discountType: string;
        discountValue: string | number;
    }, {}, any>>;
    discounts: {
        client: import("axios").AxiosInstance;
        getAll: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
        getById: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
        create: (data: unknown) => Promise<import("axios").AxiosResponse<any, unknown, {}, any>>;
        update: (id: string, data: unknown) => Promise<import("axios").AxiosResponse<any, unknown, {}, any>>;
        remove: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    };
};
