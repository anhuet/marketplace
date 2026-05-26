import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { getUserReviewsHandler, getUserRatingHandler } from '../controllers/reviewController';
import { updateMe, checkDisplayName, uploadMyAvatar } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';

const router = Router();

// Multer: memory storage, single avatar image, max 5 MB, images only.
// Cast to RequestHandler to resolve the @types/multer / @types/express version conflict.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const uploadSingleAvatar = avatarUpload.single('avatar') as unknown as RequestHandler;

// Authenticated endpoints — /me/* and /check-displayname must be declared
// before /:id to avoid Express matching them as ID segments.
router.patch('/me', requireAuth, attachUser, updateMe);
router.get('/check-displayname', requireAuth, attachUser, checkDisplayName);
router.post('/me/avatar', requireAuth, attachUser, uploadSingleAvatar, uploadMyAvatar);

// Public endpoints — no auth required
router.get('/:id/reviews', getUserReviewsHandler);
router.get('/:id/rating', getUserRatingHandler);

export default router;
