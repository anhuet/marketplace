import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import {
  saveListing,
  unsaveListing,
  getSavedListings,
  isListingSaved,
  getSavedListingIds,
} from '../services/savedService';

export async function saveListingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listingId } = z.object({ listingId: z.string().uuid() }).parse(req.body);
    const saved = await saveListing(req.dbUser!.id, listingId).catch((err: Error) => {
      switch (err.message) {
        case 'NOT_FOUND':
          throw new AppError(404, 'NOT_FOUND', 'Listing not found');
        case 'ALREADY_SAVED':
          throw new AppError(409, 'CONFLICT', 'Listing is already saved');
        default:
          throw err;
      }
    });
    res.status(201).json({ saved });
  } catch (err) {
    next(err);
  }
}

export async function unsaveListingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listingId } = z.object({ listingId: z.string().uuid() }).parse(req.params);
    await unsaveListing(req.dbUser!.id, listingId).catch((err: Error) => {
      if (err.message === 'NOT_FOUND') {
        throw new AppError(404, 'NOT_FOUND', 'Saved listing not found');
      }
      throw err;
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getSavedListingsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);

    const result = await getSavedListings(req.dbUser!.id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function checkSavedHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listingId } = z.object({ listingId: z.string().uuid() }).parse(req.params);
    const isSaved = await isListingSaved(req.dbUser!.id, listingId);
    res.json({ isSaved });
  } catch (err) {
    next(err);
  }
}

export async function getSavedIdsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ids = await getSavedListingIds(req.dbUser!.id);
    res.json({ listingIds: ids });
  } catch (err) {
    next(err);
  }
}
