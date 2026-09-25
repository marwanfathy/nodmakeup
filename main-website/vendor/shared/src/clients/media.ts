import axios, { AxiosRequestConfig } from 'axios';
import type { MediaUploadResult } from '../api/types';

export interface MediaClientOptions {
  baseURL: string;
  onUploadProgress?: (event: unknown) => void;
}

/**
 * Media domain client — uploads + file lifecycle against the media service.
 * The path constants live here (media service has no /api/v1 base).
 */
export const MEDIA_ROUTES = {
  products: '/api/upload-product-image',
  stories: '/api/upload-story',
  heroMedia: '/api/upload-hero-media',
  audio: '/api/upload-audio',
  delete: '/api/delete',
} as const;

const upload = (baseURL: string, route: string, file: File | Blob, onUploadProgress?: (e: unknown) => void) => {
  const formData = new FormData();
  formData.append('media', file);
  return axios.post<MediaUploadResult>(`${baseURL}${route}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  } as AxiosRequestConfig);
};

/** Media upload client (browser). */
export const mediaApi = (baseURL: string, onUploadProgress?: (e: unknown) => void) => ({
  baseURL,

  uploadProductImage: (file: File | Blob) => upload(baseURL, MEDIA_ROUTES.products, file, onUploadProgress),
  uploadStory: (file: File | Blob) => upload(baseURL, MEDIA_ROUTES.stories, file, onUploadProgress),
  uploadHeroMedia: (file: File | Blob) => upload(baseURL, MEDIA_ROUTES.heroMedia, file, onUploadProgress),
  uploadAudio: (file: File | Blob) => upload(baseURL, MEDIA_ROUTES.audio, file, onUploadProgress),

  deleteFile: (filePath: string) => axios.post(`${baseURL}${MEDIA_ROUTES.delete}`, { filePath }),

  /** Build an absolute media URL from a stored relative path. */
  absoluteUrl: (pathOrUrl: string | null | undefined): string => {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${baseURL.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\/+/, '')}`;
  },
});