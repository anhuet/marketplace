import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import { requireActiveUser } from '../middleware/requireActiveUser';
import {
  createListingHandler,
  getListingHandler,
  updateListingHandler,
  deleteListingHandler,
  updateListingStatusHandler,
  getSellerListingsHandler,
  getListingBuyersHandler,
  addListingImagesHandler,
  deleteListingImageHandler,
} from '../controllers/listingController';
import { parseVoiceListingHandler } from '../controllers/voiceController';

const router = Router();

// Multer: memory storage, images only, max 8 files × 10 MB each.
// Cast to RequestHandler to resolve the @types/multer / @types/express version conflict
// where multer ships its own bundled copy of @types/express-serve-static-core.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const uploadImages = upload.array('images', 8) as unknown as RequestHandler;

// Multer for the voice-parse endpoint: single audio file, max 25 MB (Whisper limit).
// Accept audio/* and video/* (some RN recorders report m4a as video/mp4).
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

const uploadAudio = audioUpload.single('audio') as unknown as RequestHandler;

// Public routes — no auth required
router.get('/seller/:sellerId', getSellerListingsHandler);
router.get('/:id', getListingHandler);

// Voice-fill — declared before /:id-prefixed authenticated routes for clarity
router.post(
  '/voice-parse',
  requireAuth,
  attachUser,
  requireActiveUser,
  uploadAudio,
  parseVoiceListingHandler,
);

// Authenticated routes
router.post('/', requireAuth, attachUser, requireActiveUser, uploadImages, createListingHandler);
router.put('/:id', requireAuth, attachUser, requireActiveUser, updateListingHandler);
router.delete('/:id', requireAuth, attachUser, deleteListingHandler);
router.patch('/:id/status', requireAuth, attachUser, updateListingStatusHandler);
router.get('/:id/buyers', requireAuth, attachUser, getListingBuyersHandler);

// Image management
router.post('/:id/images', requireAuth, attachUser, requireActiveUser, uploadImages, addListingImagesHandler);
router.delete('/:id/images/:imageId', requireAuth, attachUser, deleteListingImageHandler);

export default router;
