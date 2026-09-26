"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmAdminApi = void 0;
const endpoints_1 = require("../api/endpoints");
const client_1 = require("./client");
/** CRM admin client (admin-only system). */
const crmAdminApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        getOverview: async () => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.crm.overview)),
        getSegments: async () => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.crm.segments)),
        getCustomers: async (params = {}) => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.crm.customers.root, { params })),
        getCustomer: async (id) => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.crm.customers.byId(id))),
        updateCustomer: async (id, data) => (0, client_1.unwrap)(client.put(endpoints_1.API_V1.crm.customers.byId(id), data)),
        addNote: async (id, note) => (0, client_1.unwrap)(client.post(endpoints_1.API_V1.crm.customers.notes(id), { note })),
        backfill: async () => (0, client_1.unwrap)(client.post(endpoints_1.API_V1.crm.backfill)),
    };
};
exports.crmAdminApi = crmAdminApi;
