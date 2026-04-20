import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { attachUser } from '../middleware/attachUser';
import {
  saveListingHandler,
  unsaveListingHandler,
  getSavedListingsHandler,
  checkSavedHandler,
  getSavedIdsHandler,
} from '../controllers/savedController';

const router = Router();

// All saved endpoints require authentication
router.use(requireAuth, attachUser);

router.get('/', getSavedListingsHandler);
router.get('/ids', getSavedIdsHandler);
router.get('/:listingId', checkSavedHandler);
router.post('/', saveListingHandler);
router.delete('/:listingId', unsaveListingHandler);

export default router;
