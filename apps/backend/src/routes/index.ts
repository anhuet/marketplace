import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import invitesRouter from './invites';
import listingsRouter from './listings';
import discoveryRouter from './discovery';
import reviewsRouter from './reviews';
import usersRouter from './users';
import conversationsRouter from './conversations';
import pushTokensRouter from './pushTokens';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/invites', invitesRouter);
router.use('/listings', listingsRouter);
router.use('/discover', discoveryRouter);
router.use('/reviews', reviewsRouter);
router.use('/users', usersRouter);
router.use('/conversations', conversationsRouter);
router.use('/push-tokens', pushTokensRouter);

export default router;
