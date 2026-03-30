import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import {
  startConversation,
  getMyConversations,
  getMessages,
  sendMessage,
} from '../controllers/chatController';

const router = Router();

// All conversation routes require auth
router.post('/', requireAuth, attachUser, startConversation);
router.get('/', requireAuth, attachUser, getMyConversations);
router.get('/:id/messages', requireAuth, attachUser, getMessages);
router.post('/:id/messages', requireAuth, attachUser, sendMessage);

export default router;
