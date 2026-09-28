import { API_V1 } from '../api/endpoints';
import type {
  AppliedDiscount,
  Cart,
  CouponRejectionReason,
  OrderCreationData,
  OrderCreationResponse,
  OrderDetails,
  ShippingZone,
} from '../api/types';
import { isCouponRejectionReason } from '../api/types';
import { apiErrorBody, createApiClient, type ApiClientOptionsPatch, unwrap } from './client';

/**
 * Why a coupon was refused, read off the error `validateCoupon` rejected with.
 *
 * Null means the refusal was not one the API explained — a network drop, a 5xx,
 * a 400 from somewhere else in the stack — so the caller should fall back to a
 * generic message rather than invent a reason. That distinction matters: telling
 * a shopper their code is "expired" when the request never reached the server is
 * worse than saying nothing useful happened.
 */
export const readCouponRejection = (error: unknown): CouponRejectionReason | null => {
  const reason: unknown = apiErrorBody(error)?.reason;
  return isCouponRejectionReason(reason) ? reason : null;
};

/** Cart domain client (session resource under orders). */
export const cartApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });

  return {
    client,

    getCart: async (): Promise<Cart> => unwrap(client.get(API_V1.orders.cart.root)),

    addItem: async (variantId: string, quantity: number): Promise<Cart> =>
      unwrap(client.post(API_V1.orders.cart.items, { variantId, quantity })),

    updateItemQuantity: async (cartItemId: string, quantity: number): Promise<Cart> =>
      unwrap(client.put(API_V1.orders.cart.itemsById(cartItemId), { quantity })),

    removeItem: async (cartItemId: string): Promise<Cart> =>
      unwrap(client.delete(API_V1.orders.cart.itemsById(cartItemId))),
  };
};

/** Orders + discounts + shipping zones. */
export const ordersApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });

  return {
    client,

    createOrder: async (data: OrderCreationData): Promise<OrderCreationResponse> =>
      unwrap(client.post(API_V1.orders.orders.root, data)),

    getOrderDetails: async (orderId: string): Promise<OrderDetails> =>
      unwrap(client.get(API_V1.orders.orders.byId(orderId))),

    getShippingZones: async (): Promise<ShippingZone[]> =>
      unwrap(client.get(API_V1.orders.shippingZones.root)),

    validateCoupon: async (couponCode: string, customerPhone?: string): Promise<AppliedDiscount> =>
      unwrap(client.post(API_V1.orders.discounts.validate, { couponCode, customerPhone })),
  };
};

/** Orders admin client. */
export const ordersAdminApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });
  return {
    client,
    getAll: (params: Record<string, unknown> = {}) => client.get(API_V1.orders.orders.root, { params }),
    getById: (id: string) => client.get(API_V1.orders.orders.byId(id)),
    getStatuses: () => client.get(API_V1.orders.orders.statuses),
    updateStatus: (orderId: string, statusId: string) =>
      client.put(API_V1.orders.orders.status(orderId), { statusId }),
    updateTransactionStatus: (orderId: string, status: string) =>
      client.put(API_V1.orders.orders.transactionStatus(orderId), { status }),
    sendReward: (orderId: string, discountType: string, discountValue: number | string) =>
      client.post(API_V1.orders.orders.sendReward(orderId), { discountType, discountValue }),
    discounts: {
      client,
      getAll: (params: Record<string, unknown> = {}) => client.get(API_V1.orders.discounts.root, { params }),
      getById: (id: string) => client.get(API_V1.orders.discounts.byId(id)),
      create: (data: unknown) => client.post(API_V1.orders.discounts.root, data),
      update: (id: string, data: unknown) => client.put(API_V1.orders.discounts.byId(id), data),
      remove: (id: string) => client.delete(API_V1.orders.discounts.byId(id)),
    },
  };
};