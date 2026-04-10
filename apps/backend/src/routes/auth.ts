import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import { validate } from '../middleware/validate';
import { validateInvite, redeemInvite, getMe } from '../controllers/authController';

const router = Router();

// Public — validate invite code before Auth0 signup
router.post('/validate-invite', validate(z.object({ code: z.string().min(1) })), validateInvite);

// Authenticated — redeem invite code after first Auth0 login
router.post(
  '/redeem-invite',
  requireAuth,
  attachUser,
  validate(z.object({ code: z.string().min(1) })),
  redeemInvite,
);

// Authenticated — get current user profile
router.get('/me', requireAuth, attachUser, getMe);

export default router;
