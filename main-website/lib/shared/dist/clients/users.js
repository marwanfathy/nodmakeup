"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersAdminApi = exports.usersApi = void 0;
const endpoints_1 = require("../api/endpoints");
const client_1 = require("./client");
/** Users domain client — auth + admins. */
const usersApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        login: (credentials) => client.post(endpoints_1.API_V1.users.auth.login, credentials),
        me: () => client.get(endpoints_1.API_V1.users.auth.me),
        logout: () => client.post(endpoints_1.API_V1.users.auth.logout),
    };
};
exports.usersApi = usersApi;
/** Users admin client — admins CRUD. */
const usersAdminApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        getAll: (params = {}) => client.get(endpoints_1.API_V1.users.admins.root, { params }),
        getById: (id) => client.get(endpoints_1.API_V1.users.admins.byId(id)),
        create: (data) => client.post(endpoints_1.API_V1.users.admins.root, data),
        update: (id, data) => client.put(endpoints_1.API_V1.users.admins.byId(id), data),
        remove: (id) => client.delete(endpoints_1.API_V1.users.admins.byId(id)),
    };
};
exports.usersAdminApi = usersAdminApi;
