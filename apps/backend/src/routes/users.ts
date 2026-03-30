import { Router } from 'express';
import { getUserReviewsHandler, getUserRatingHandler } from '../controllers/reviewController';

const router = Router();

// Public endpoints — no auth required
router.get('/:id/reviews', getUserReviewsHandler);
router.get('/:id/rating', getUserRatingHandler);

export default router;
