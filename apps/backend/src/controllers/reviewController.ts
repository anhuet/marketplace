import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { createReview, getUserReviews, getUserRating } from '../services/reviewService';

const createReviewSchema = z.object({
  listingId: z.string().uuid(),
  revieweeId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function createReviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = createReviewSchema.parse(req.body);
    const review = await createReview({ ...data, reviewerId: req.dbUser!.id }).catch(
      (err: Error) => {
        switch (err.message) {
          case 'NOT_FOUND':
            throw new AppError(404, 'NOT_FOUND', 'Listing not found');
          case 'NOT_SOLD':
            throw new AppError(422, 'UNPROCESSABLE', 'Listing must be SOLD before reviewing');
          case 'FORBIDDEN':
            throw new AppError(403, 'FORBIDDEN', 'You must be a participant in this transaction');
          case 'SELF_REVIEW':
            throw new AppError(400, 'VALIDATION_ERROR', 'Cannot review yourself');
          case 'DUPLICATE':
            throw new AppError(409, 'CONFLICT', 'You have already reviewed this transaction');
          default:
            throw err;
        }
      },
    );
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}

export async function getUserReviewsHandler(
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

    const result = await getUserReviews(req.params.id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUserRatingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getUserRating(req.params.id);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    res.json(user);
  } catch (err) {
    next(err);
  }
}
