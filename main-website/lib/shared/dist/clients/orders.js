"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersAdminApi = exports.ordersApi = exports.cartApi = exports.readCouponRejection = void 0;
const endpoints_1 = require("../api/endpoints");
const types_1 = require("../api/types");
const client_1 = require("./client");
/**
 * Why a coupon was refused, read off the error `validateCoupon` rejected with.
 *
 * Null means the refusal was not one the API explained — a network drop, a 5xx,
 * a 400 from somewhere else in the stack — so the caller should fall back to a
 * generic message rather than invent a reason. That distinction matters: telling
 * a shopper their code is "expired" when the request never reached the server is
 * worse than saying nothing useful happened.
 */
const readCouponRejection = (error) => {
    var _a;
    const reason = (_a = (0, client_1.apiErrorBody)(error)) === null || _a === void 0 ? void 0 : _a.reason;
    return (0, types_1.isCouponRejectionReason)(reason) ? reason : null;
};
exports.readCouponRejection = readCouponRejection;
/** Cart domain client (session resource under orders). */
const cartApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        getCart: async () => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.orders.cart.root)),
        addItem: async (variantId, quantity) => (0, client_1.unwrap)(client.post(endpoints_1.API_V1.orders.cart.items, { variantId, quantity })),
        updateItemQuantity: async (cartItemId, quantity) => (0, client_1.unwrap)(client.put(endpoints_1.API_V1.orders.cart.itemsById(cartItemId), { quantity })),
        removeItem: async (cartItemId) => (0, client_1.unwrap)(client.delete(endpoints_1.API_V1.orders.cart.itemsById(cartItemId))),
    };
};
exports.cartApi = cartApi;
/** Orders + discounts + shipping zones. */
const ordersApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        createOrder: async (data) => (0, client_1.unwrap)(client.post(endpoints_1.API_V1.orders.orders.root, data)),
        getOrderDetails: async (orderId) => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.orders.orders.byId(orderId))),
        /**
         * Public order lookup by order number. A POST so the identifier does not
         * land in URL logs; the request is read-only and carries one field.
         */
        trackOrder: async (orderNumber) => (0, client_1.unwrap)(client.post(endpoints_1.API_V1.orders.orders.track, { orderNumber })),
        getShippingZones: async () => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.orders.shippingZones.root)),
        validateCoupon: async (couponCode, customerPhone) => (0, client_1.unwrap)(client.post(endpoints_1.API_V1.orders.discounts.validate, { couponCode, customerPhone })),
    };
};
exports.ordersApi = ordersApi;
/** Orders admin client. */
const ordersAdminApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        getAll: (params = {}) => client.get(endpoints_1.API_V1.orders.orders.root, { params }),
        getById: (id) => client.get(endpoints_1.API_V1.orders.orders.byId(id)),
        getStatuses: () => client.get(endpoints_1.API_V1.orders.orders.statuses),
        updateStatus: (orderId, statusId) => client.put(endpoints_1.API_V1.orders.orders.status(orderId), { statusId }),
        updateTransactionStatus: (orderId, status) => client.put(endpoints_1.API_V1.orders.orders.transactionStatus(orderId), { status }),
        sendReward: (orderId, discountType, discountValue) => client.post(endpoints_1.API_V1.orders.orders.sendReward(orderId), { discountType, discountValue }),
        discounts: {
            client,
            getAll: (params = {}) => client.get(endpoints_1.API_V1.orders.discounts.root, { params }),
            getById: (id) => client.get(endpoints_1.API_V1.orders.discounts.byId(id)),
            create: (data) => client.post(endpoints_1.API_V1.orders.discounts.root, data),
            update: (id, data) => client.put(endpoints_1.API_V1.orders.discounts.byId(id), data),
            remove: (id) => client.delete(endpoints_1.API_V1.orders.discounts.byId(id)),
        },
    };
};
exports.ordersAdminApi = ordersAdminApi;
