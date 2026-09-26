// ONE multer factory for every media kind. Configuration lives in a table at
// the bottom; this replaces the four near-identical middleware files
// (productImageUpload / storyUpload / heroMediaUpload / audioUpload).
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { MIME } from '../utils/mime.js';

// All kinds stage into public/temp (single staging dir). The legacy audio
// staging dir (media-server/temp) is no longer used.
const STAGING_DIR = path.join(import.meta.dirname, '../../public/temp');

const MAX_BYTES = {
  image: 10 * 1024 * 1024, // 10 MB — product shots
  media: 100 * 1024 * 1024, // 100 MB — story/hero raw video
  audio: 10 * 1024 * 1024, // 10 MB
};

// File-filters preserve the exact legacy validation for each kind.
const FILE_FILTERS = {
  // Legacy productImageUpload: BOTH extension and mimetype must be an image.
  image: (_req, file, cb) => {
    const extOk = MIME.IMAGE.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = MIME.IMAGE.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Error: Images Only! (jpeg, jpg, png, gif, webp)'));
  },
  // Legacy story/hero: images and videos.
  media: (_req, file, cb) => {
    const extOk = MIME.MEDIA.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = MIME.MEDIA.test(file.mimetype) || file.mimetype.startsWith(MIME.VIDEO_PREFIX);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Invalid file type! Only images and videos are allowed.'));
  },
  // Legacy audioUpload: any audio/* mimetype.
  audio: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) return cb(null, true);
    cb(new Error('Not an audio file! Please upload MP3, WAV, etc.'));
  },
};

function diskStorage(filenamePrefix) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(STAGING_DIR)) fs.mkdirSync(STAGING_DIR, { recursive: true });
      cb(null, STAGING_DIR);
    },
    filename: (_req, file, cb) => {
      // Unique name: timestamp + random number + original extension (parity with legacy).
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${filenamePrefix}${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });
}

function createUploader({ kind, filenamePrefix, maxBytes }) {
  return multer({
    storage: diskStorage(filenamePrefix),
    limits: { fileSize: maxBytes },
    fileFilter: FILE_FILTERS[kind],
  });
}

// ── Kind configuration (the only place upload rules are defined) ──
export const productImageUploader = createUploader({ kind: 'image', filenamePrefix: 'prod-raw-', maxBytes: MAX_BYTES.image });
export const storyUploader = createUploader({ kind: 'media', filenamePrefix: 'story-raw-', maxBytes: MAX_BYTES.media });
export const heroMediaUploader = createUploader({ kind: 'media', filenamePrefix: 'hero-raw-', maxBytes: MAX_BYTES.media });
export const audioUploader = createUploader({ kind: 'audio', filenamePrefix: 'audio-', maxBytes: MAX_BYTES.audio });