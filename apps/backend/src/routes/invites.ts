import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import { validateCode, getMyInviteCode } from '../controllers/inviteController';

const router = Router();

// Public — check if a code is valid (no auth required)
router.get('/validate/:code', validateCode);

// Authenticated — get the current user's own invite code
router.get('/mine', requireAuth, attachUser, getMyInviteCode);

export default router;
