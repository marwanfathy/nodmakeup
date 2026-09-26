import type { MediaUploadResult } from '../api/types';
export interface MediaClientOptions {
    baseURL: string;
    onUploadProgress?: (event: unknown) => void;
}
/**
 * Media domain client — uploads + file lifecycle against the media service.
 * The path constants live here (media service has no /api/v1 base).
 */
export declare const MEDIA_ROUTES: {
    readonly products: "/api/upload-product-image";
    readonly stories: "/api/upload-story";
    readonly heroMedia: "/api/upload-hero-media";
    readonly audio: "/api/upload-audio";
    readonly delete: "/api/delete";
};
/** Media upload client (browser). */
export declare const mediaApi: (baseURL: string, onUploadProgress?: (e: unknown) => void) => {
    baseURL: string;
    uploadProductImage: (file: File | Blob) => Promise<import("axios").AxiosResponse<MediaUploadResult, any, {}, any>>;
    uploadStory: (file: File | Blob) => Promise<import("axios").AxiosResponse<MediaUploadResult, any, {}, any>>;
    uploadHeroMedia: (file: File | Blob) => Promise<import("axios").AxiosResponse<MediaUploadResult, any, {}, any>>;
    uploadAudio: (file: File | Blob) => Promise<import("axios").AxiosResponse<MediaUploadResult, any, {}, any>>;
    deleteFile: (filePath: string) => Promise<import("axios").AxiosResponse<any, {
        filePath: string;
    }, {}, any>>;
    /** Build an absolute media URL from a stored relative path. */
    absoluteUrl: (pathOrUrl: string | null | undefined) => string;
};
