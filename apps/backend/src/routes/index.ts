import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import invitesRouter from './invites';
import listingsRouter from './listings';
import discoveryRouter from './discovery';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/invites', invitesRouter);
router.use('/listings', listingsRouter);
router.use('/discover', discoveryRouter);

// More feature routes added as tasks complete:
// router.use('/users', usersRouter);
// router.use('/conversations', conversationsRouter);
// router.use('/reviews', reviewsRouter);

export default router;
