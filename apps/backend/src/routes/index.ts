import { Router } from 'express';
import healthRouter from './health';

const router = Router();

router.use('/health', healthRouter);

// Feature routes will be added here as tasks are completed:
// router.use('/auth', authRouter);
// router.use('/users', usersRouter);
// router.use('/listings', listingsRouter);
// router.use('/conversations', conversationsRouter);
// router.use('/reviews', reviewsRouter);

export default router;
