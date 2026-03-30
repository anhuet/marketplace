import { Router } from 'express';
import { nearbyListings, listCategories } from '../controllers/discoveryController';

const router = Router();

// Public endpoints — no auth required (FR-030, FR-031)
router.get('/nearby', nearbyListings);
router.get('/categories', listCategories);

export default router;
