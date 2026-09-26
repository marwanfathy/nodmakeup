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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.unwrap = exports.createApiClient = void 0;
const axios_1 = __importStar(require("axios"));
const createApiClient = (options) => {
    var _a, _b;
    const client = axios_1.default.create({
        baseURL: options.baseURL.replace(/\/+$/, ''),
        withCredentials: (_a = options.withCredentials) !== null && _a !== void 0 ? _a : true,
        headers: { 'Content-Type': 'application/json', ...((_b = options.headers) !== null && _b !== void 0 ? _b : {}) },
    });
    client.interceptors.request.use((config) => {
        var _a;
        if (typeof window !== 'undefined' && options.headerProvider) {
            const extra = options.headerProvider();
            config.headers = (_a = config.headers) !== null && _a !== void 0 ? _a : new axios_1.AxiosHeaders();
            for (const [key, value] of Object.entries(extra)) {
                config.headers.set(key, value);
            }
        }
        return config;
    });
    return client;
};
exports.createApiClient = createApiClient;
/** Unwrap the `{ data }`/`{ success, data }` envelope. */
const unwrap = async (request) => {
    const res = await request;
    const body = res.data;
    if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
        return body.data;
    }
    return body;
};
exports.unwrap = unwrap;
