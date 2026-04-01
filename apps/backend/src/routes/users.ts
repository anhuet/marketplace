import { Router } from 'express';
import { getUserReviewsHandler, getUserRatingHandler } from '../controllers/reviewController';
import { updateMe } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';

const router = Router();

// Authenticated endpoints — /me routes must be declared before /:id to avoid ambiguous matching
router.patch('/me', requireAuth, attachUser, updateMe);

// Public endpoints — no auth required
router.get('/:id/reviews', getUserReviewsHandler);
router.get('/:id/rating', getUserRatingHandler);

export default router;
