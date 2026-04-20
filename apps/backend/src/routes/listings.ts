import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import {
  createListingHandler,
  getListingHandler,
  updateListingHandler,
  deleteListingHandler,
  updateListingStatusHandler,
  getSellerListingsHandler,
  getListingBuyersHandler,
} from '../controllers/listingController';

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

// Public routes — no auth required
router.get('/seller/:sellerId', getSellerListingsHandler);
router.get('/:id', getListingHandler);

// Authenticated routes
router.post('/', requireAuth, attachUser, uploadImages, createListingHandler);
router.put('/:id', requireAuth, attachUser, uploadImages, updateListingHandler);
router.delete('/:id', requireAuth, attachUser, deleteListingHandler);
router.patch('/:id/status', requireAuth, attachUser, updateListingStatusHandler);
router.get('/:id/buyers', requireAuth, attachUser, getListingBuyersHandler);

export default router;
