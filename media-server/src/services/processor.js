// Processing pipeline: sharp for images, ffmpeg for video/audio.
// These functions know nothing about express — the routes feed them staged
// file paths + metadata and receive { filename, path, thumbnailUrl? } back.
import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { mediaBaseUrl } from '../config/index.js';
import { ensureDir, relativeUrl, permanentPath, THUMBNAILS_DIR, moveIntoUploads } from './storage.js';

/** Optimize an image to webp (parity: quality 80, effort 2) and drop the raw file. */
export async function optimizeImage(stagedPath, folder) {
  const filename = `${path.basename(stagedPath, path.extname(stagedPath))}.webp`;
  const destPath = permanentPath(folder, filename);
  ensureDir(path.dirname(destPath));

  await sharp(stagedPath).webp({ quality: 80, effort: 2 }).toFile(destPath);

  fs.unlink(stagedPath, (err) => {
    if (err) console.error('Error deleting temp file:', err);
  });
  return { filename, path: relativeUrl(folder, filename) };
}

/** Transcode any video to H.264/AAC mp4 (parity: crf 26, veryfast, faststart). */
export function optimizeVideo(stagedPath, folder) {
  return new Promise((resolve, reject) => {
    const filename = `${path.basename(stagedPath, path.extname(stagedPath))}.mp4`;
    const destPath = permanentPath(folder, filename);
    ensureDir(path.dirname(destPath));

    ffmpeg(stagedPath)
      .output(destPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-crf 26', '-preset veryfast', '-movflags +faststart'])
      .on('end', () => {
        fs.unlink(stagedPath, () => {});
        resolve({ filename, path: relativeUrl(folder, filename) });
      })
      .on('error', (err) => {
        console.error('Video processing error:', err);
        reject(err);
      })
      .run();
  });
}

/** Transcode any audio to mp3 at 128k (parity with legacy). */
export function optimizeAudio(stagedPath, folder) {
  return new Promise((resolve, reject) => {
    const filename = `${path.basename(stagedPath, path.extname(stagedPath))}.mp3`;
    const destPath = permanentPath(folder, filename);
    ensureDir(path.dirname(destPath));

    ffmpeg(stagedPath)
      .output(destPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .on('end', () => {
        fs.unlink(stagedPath, () => {});
        resolve({ filename, path: relativeUrl(folder, filename) });
      })
      .on('error', (err) => {
        console.error('Audio processing error:', err);
        reject(err);
      })
      .run();
  });
}

/** Generate a 1s-frame PNG thumbnail for a video; resolves the absolute URL. */
export function generateVideoThumbnail(filePath) {
  return new Promise((resolve, reject) => {
    const thumbnailDir = ensureDir(THUMBNAILS_DIR);
    const baseName = path.basename(filePath, path.extname(filePath));
    const thumbnailFilename = `thumb-${baseName}.png`;

    ffmpeg(filePath)
      .on('error', reject)
      .on('end', () => resolve(`${mediaBaseUrl}/thumbnails/${thumbnailFilename}`))
      .screenshots({
        count: 1,
        timemarks: ['1'],
        folder: thumbnailDir,
        filename: thumbnailFilename,
      });
  });
}

/**
 * Process a staged image/video by kind. Video gets a best-effort thumbnail
 * (a failure there must not fail the whole upload, matching legacy behavior).
 */
export async function processUpload({ stagedPath, folder, mimetype }) {
  if (mimetype && mimetype.startsWith('video/')) {
    let thumbnailUrl = null;
    try {
      thumbnailUrl = await generateVideoThumbnail(stagedPath, folder);
    } catch {
      // Thumbnails are best-effort — the transcode below is the source of truth.
    }
    const result = await optimizeVideo(stagedPath, folder);
    return { ...result, thumbnailUrl };
  }

  const result = await optimizeImage(stagedPath, folder);
  return { ...result, thumbnailUrl: null };
}

/**
 * Process a staged audio upload. MP3s pass through untouched (parity: legacy
 * renamed the raw file in place); everything else is transcoded to mp3/128k.
 */
export async function processAudio({ stagedPath, originalName, mimetype }) {
  const isMp3 = mimetype === 'audio/mpeg' || path.extname(originalName).toLowerCase() === '.mp3';
  if (isMp3) {
    const filename = path.basename(stagedPath);
    moveIntoUploads(stagedPath, 'audio', filename);
    return { filename, path: relativeUrl('audio', filename) };
  }
  return optimizeAudio(stagedPath, 'audio');
}