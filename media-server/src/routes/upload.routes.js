// Write endpoints — the same 5 legacy paths the shared media client and the
// admin panel are built against. Routes stay thin: multer (uploader) →
// storage/processor services → JSON. No sharp/ffmpeg here.
import { Router } from 'express';
import fs from 'node:fs';
import {
  productImageUploader,
  storyUploader,
  heroMediaUploader,
  audioUploader,
} from '../middleware/uploader.js';
import { sanitizeRelPath } from '../middleware/sanitize.js';
import { mediaBaseUrl } from '../config/index.js';
import * as processor from '../services/processor.js';
import * as storage from '../services/storage.js';

const router = Router();

/**
 * Thin handler factory for image/video uploads.
 * `messages` keeps the exact legacy response copy per endpoint.
 */
function mediaUploadHandler(uploader, folder, messages) {
  return async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    try {
      const result = await processor.processUpload({
        stagedPath: req.file.path,
        folder,
        mimetype: req.file.mimetype,
      });

      const body = { message: messages.ok, url: `${mediaBaseUrl}/${result.path}`, path: result.path };
      if (result.thumbnailUrl) body.thumbnailUrl = result.thumbnailUrl;
      res.status(201).json(body);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: messages.fail });
    }
  };
}

async function handleAudioUpload(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No audio file uploaded.' });

  try {
    const result = await processor.processAudio({
      stagedPath: req.file.path,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    res.status(201).json({
      message: 'Audio uploaded successfully!',
      url: `${mediaBaseUrl}/${result.path}`,
      path: result.path,
    });
  } catch (error) {
    console.error('Audio upload failed:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Audio processing failed.', error: error.message });
  }
}

async function handleDelete(req, res) {
  const filePath = req.body?.filePath;
  if (!filePath) return res.status(400).json({ message: 'Path required.' });

  const safe = sanitizeRelPath(filePath, 'uploads');
  if (!safe) return res.status(400).json({ message: 'Invalid path.' });

  const removed = await storage.deleteMediaPath(safe);
  if (!removed) return res.status(500).json({ message: 'Deletion failed (or file missing).' });

  res.status(200).json({ message: 'Deleted.' });
}

router.post('/api/upload-product-image', productImageUploader.single('media'), mediaUploadHandler(productImageUploader, 'products', { ok: 'Image uploaded!', fail: 'Optimization failed.' }));

router.post('/api/upload-story', storyUploader.single('media'), mediaUploadHandler(storyUploader, 'stories', { ok: 'Story uploaded!', fail: 'Processing failed.' }));

router.post('/api/upload-hero-media', heroMediaUploader.single('media'), mediaUploadHandler(heroMediaUploader, 'hero', { ok: 'Hero uploaded!', fail: 'Hero upload failed.' }));

router.post('/api/upload-audio', audioUploader.single('media'), handleAudioUpload);

router.post('/api/delete', handleDelete);

export default router;