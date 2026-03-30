import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import { createReviewHandler } from '../controllers/reviewController';

const router = Router();

router.post('/', requireAuth, attachUser, createReviewHandler);

export default router;
