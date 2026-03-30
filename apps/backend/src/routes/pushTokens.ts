import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import { registerPushToken, deletePushToken } from '../controllers/pushTokenController';

const router = Router();

router.post('/', requireAuth, attachUser, registerPushToken);
router.delete('/:token', requireAuth, attachUser, deletePushToken);

export default router;
