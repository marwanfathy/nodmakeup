"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaApi = exports.MEDIA_ROUTES = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Media domain client — uploads + file lifecycle against the media service.
 * The path constants live here (media service has no /api/v1 base).
 */
exports.MEDIA_ROUTES = {
    products: '/api/upload-product-image',
    stories: '/api/upload-story',
    heroMedia: '/api/upload-hero-media',
    audio: '/api/upload-audio',
    delete: '/api/delete',
};
const upload = (baseURL, route, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('media', file);
    return axios_1.default.post(`${baseURL}${route}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
    });
};
/** Media upload client (browser). */
const mediaApi = (baseURL, onUploadProgress) => ({
    baseURL,
    uploadProductImage: (file) => upload(baseURL, exports.MEDIA_ROUTES.products, file, onUploadProgress),
    uploadStory: (file) => upload(baseURL, exports.MEDIA_ROUTES.stories, file, onUploadProgress),
    uploadHeroMedia: (file) => upload(baseURL, exports.MEDIA_ROUTES.heroMedia, file, onUploadProgress),
    uploadAudio: (file) => upload(baseURL, exports.MEDIA_ROUTES.audio, file, onUploadProgress),
    deleteFile: (filePath) => axios_1.default.post(`${baseURL}${exports.MEDIA_ROUTES.delete}`, { filePath }),
    /** Build an absolute media URL from a stored relative path. */
    absoluteUrl: (pathOrUrl) => {
        if (!pathOrUrl)
            return '';
        if (/^https?:\/\//i.test(pathOrUrl))
            return pathOrUrl;
        return `${baseURL.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\/+/, '')}`;
    },
});
exports.mediaApi = mediaApi;
