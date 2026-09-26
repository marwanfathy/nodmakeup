"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDIA_ROUTES = exports.mediaApi = exports.crmAdminApi = exports.usersAdminApi = exports.usersApi = exports.analyticsAdminApi = exports.analyticsApi = exports.ordersAdminApi = exports.ordersApi = exports.cartApi = exports.contentAdminApi = exports.contentApi = exports.catalogAdminApi = exports.catalogApi = exports.unwrap = exports.createApiClient = exports.deriveClientBaseUrl = exports.allowOrigin = exports.originMatches = exports.parseOriginList = exports.defaultPortOf = exports.SERVICES = exports.ENV_CONTRACT = exports.PUBLIC_LIST_QUERY = exports.API_PREFIX = exports.API_V1 = void 0;
var endpoints_1 = require("./api/endpoints");
Object.defineProperty(exports, "API_V1", { enumerable: true, get: function () { return endpoints_1.API_V1; } });
Object.defineProperty(exports, "API_PREFIX", { enumerable: true, get: function () { return endpoints_1.API_PREFIX; } });
Object.defineProperty(exports, "PUBLIC_LIST_QUERY", { enumerable: true, get: function () { return endpoints_1.PUBLIC_LIST_QUERY; } });
__exportStar(require("./api/types"), exports);
// Runtime contract — pure (browser-safe): canonical env keys, ports, client
// URL resolution, CORS origin matching. This is the ONE source of truth.
var config_1 = require("./runtime/config");
Object.defineProperty(exports, "ENV_CONTRACT", { enumerable: true, get: function () { return config_1.ENV_CONTRACT; } });
Object.defineProperty(exports, "SERVICES", { enumerable: true, get: function () { return config_1.SERVICES; } });
Object.defineProperty(exports, "defaultPortOf", { enumerable: true, get: function () { return config_1.defaultPortOf; } });
Object.defineProperty(exports, "parseOriginList", { enumerable: true, get: function () { return config_1.parseOriginList; } });
Object.defineProperty(exports, "originMatches", { enumerable: true, get: function () { return config_1.originMatches; } });
Object.defineProperty(exports, "allowOrigin", { enumerable: true, get: function () { return config_1.allowOrigin; } });
Object.defineProperty(exports, "deriveClientBaseUrl", { enumerable: true, get: function () { return config_1.deriveClientBaseUrl; } });
var client_1 = require("./clients/client");
Object.defineProperty(exports, "createApiClient", { enumerable: true, get: function () { return client_1.createApiClient; } });
Object.defineProperty(exports, "unwrap", { enumerable: true, get: function () { return client_1.unwrap; } });
var catalog_1 = require("./clients/catalog");
Object.defineProperty(exports, "catalogApi", { enumerable: true, get: function () { return catalog_1.catalogApi; } });
Object.defineProperty(exports, "catalogAdminApi", { enumerable: true, get: function () { return catalog_1.catalogAdminApi; } });
var content_1 = require("./clients/content");
Object.defineProperty(exports, "contentApi", { enumerable: true, get: function () { return content_1.contentApi; } });
Object.defineProperty(exports, "contentAdminApi", { enumerable: true, get: function () { return content_1.contentAdminApi; } });
var orders_1 = require("./clients/orders");
Object.defineProperty(exports, "cartApi", { enumerable: true, get: function () { return orders_1.cartApi; } });
Object.defineProperty(exports, "ordersApi", { enumerable: true, get: function () { return orders_1.ordersApi; } });
Object.defineProperty(exports, "ordersAdminApi", { enumerable: true, get: function () { return orders_1.ordersAdminApi; } });
var analytics_1 = require("./clients/analytics");
Object.defineProperty(exports, "analyticsApi", { enumerable: true, get: function () { return analytics_1.analyticsApi; } });
Object.defineProperty(exports, "analyticsAdminApi", { enumerable: true, get: function () { return analytics_1.analyticsAdminApi; } });
var users_1 = require("./clients/users");
Object.defineProperty(exports, "usersApi", { enumerable: true, get: function () { return users_1.usersApi; } });
Object.defineProperty(exports, "usersAdminApi", { enumerable: true, get: function () { return users_1.usersAdminApi; } });
var crm_1 = require("./clients/crm");
Object.defineProperty(exports, "crmAdminApi", { enumerable: true, get: function () { return crm_1.crmAdminApi; } });
var media_1 = require("./clients/media");
Object.defineProperty(exports, "mediaApi", { enumerable: true, get: function () { return media_1.mediaApi; } });
Object.defineProperty(exports, "MEDIA_ROUTES", { enumerable: true, get: function () { return media_1.MEDIA_ROUTES; } });
