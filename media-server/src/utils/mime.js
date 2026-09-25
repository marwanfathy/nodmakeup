// Media classification rules shared by the uploader (fileFilter) and the
// processor (video-vs-image dispatch). Pure rules — no I/O, no express types.
const IMAGE_REGEX = /jpeg|jpg|png|gif|webp/;
const VIDEO_REGEX = /mp4|webm|mov|quicktime/;

export const MIME = {
  /** Extensions + mimetypes accepted for image-only uploads (parity with legacy). */
  IMAGE: IMAGE_REGEX,
  /** Extensions + mimetypes accepted for image-or-video uploads. */
  MEDIA: /jpeg|jpg|png|gif|webp|mp4|webm|mov|quicktime/,
  /** Broad video mimetype probe (covers mp4/webm/quicktime and container variants). */
  VIDEO_PREFIX: 'video/',
};

/**
 * Classify how a staged file must be processed based on its declared mimetype.
 * Video drives the ffmpeg + thumbnail path; everything else goes to sharp.
 * Mirrors the dispatch the legacy handlers performed inline.
 */
export function processingKind(mimetype) {
  if (!mimetype) return 'image';
  if (mimetype.startsWith(MIME.VIDEO_PREFIX)) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'image';
}