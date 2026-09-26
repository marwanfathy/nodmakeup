// Disk-layer helpers: staging + permanent paths, moves, deletes.
// Pure node-io functions — no express types, no processing logic.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT_DIR = path.join(import.meta.dirname, '../..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
export const THUMBNAILS_DIR = path.join(PUBLIC_DIR, 'thumbnails');
export const STAGING_DIR = path.join(PUBLIC_DIR, 'temp');

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Relative URL path for a processed file ("uploads/<folder>/<file>"). */
export function relativeUrl(folder, filename) {
  return `uploads/${folder}/${filename}`;
}

/** Absolute destination for a processed file under uploads/<folder>. */
export function permanentPath(folder, filename) {
  return path.join(UPLOADS_DIR, folder, filename);
}

/** Move a raw staged file into its permanent uploads/<folder> location. */
export function moveIntoUploads(stagedPath, folder, filename) {
  const destPath = permanentPath(folder, filename);
  ensureDir(path.dirname(destPath));
  fs.renameSync(stagedPath, destPath);
  return destPath;
}

/** Delete a file at an absolute path; resolves true when removed. */
export function deleteFile(absPath) {
  return new Promise((resolve) => {
    fs.unlink(absPath, (err) => resolve(!err));
  });
}

/** Delete a caller-validated relative media path; resolves true when removed. */
export async function deleteMediaPath(safeRelPath) {
  const full = path.join(PUBLIC_DIR, safeRelPath);
  return deleteFile(full);
}