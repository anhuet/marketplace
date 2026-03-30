import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getNearbyListings, getCategories } from '../services/discoveryService';

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(100).default(10),
  categoryId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function nearbyListings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = nearbyQuerySchema.parse(req.query);
    const result = await getNearbyListings(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await getCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}
