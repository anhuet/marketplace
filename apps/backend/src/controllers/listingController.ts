import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import {
  createListing,
  getListingById,
  updateListing,
  softDeleteListing,
  updateListingStatus,
  getSellerListings,
} from '../services/listingService';
import { uploadImageToS3 } from '../lib/s3';
import { Condition, ListingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts either a UUID or a slug — always returns the category UUID. */
async function resolveCategoryId(value: string): Promise<string> {
  if (UUID_REGEX.test(value)) {
    const exists = await prisma.category.findUnique({ where: { id: value }, select: { id: true } });
    if (!exists) throw new AppError(400, 'VALIDATION_ERROR', 'Category not found');
    return value;
  }
  const cat = await prisma.category.findUnique({ where: { slug: value }, select: { id: true } });
  if (!cat) throw new AppError(400, 'VALIDATION_ERROR', `Category not found: ${value}`);
  return cat.id;
}

const MAX_IMAGES = 8;

const createListingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  price: z.coerce.number().min(0),
  condition: z.nativeEnum(Condition),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  categoryId: z.string().min(1),
});

const updateListingSchema = createListingSchema.partial();

const statusSchema = z.object({
  status: z.enum(['SOLD']),
});

async function processUploadedImages(req: Request): Promise<string[]> {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) return [];
  if (files.length > MAX_IMAGES) {
    throw new AppError(400, 'VALIDATION_ERROR', `Maximum ${MAX_IMAGES} images allowed`);
  }
  return Promise.all(files.map((f) => uploadImageToS3(f.buffer, f.originalname, f.mimetype)));
}

function handleOwnershipError(err: Error): never {
  if (err.message === 'FORBIDDEN') {
    throw new AppError(403, 'FORBIDDEN', 'Not the listing owner');
  }
  throw err;
}

export async function createListingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createListingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const imageUrls = await processUploadedImages(req);
    if (imageUrls.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'At least one image is required');
    }

    const categoryId = await resolveCategoryId(parsed.data.categoryId);
    const listing = await createListing(req.dbUser!.id, { ...parsed.data, categoryId, imageUrls });
    res.status(201).json({ listing });
  } catch (err) {
    next(err);
  }
}

export async function getListingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
    res.json({ listing });
  } catch (err) {
    next(err);
  }
}

export async function updateListingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateListingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const imageUrls = req.files ? await processUploadedImages(req) : undefined;
    const categoryId = parsed.data.categoryId
      ? await resolveCategoryId(parsed.data.categoryId)
      : undefined;

    const listing = await updateListing(req.params.id, req.dbUser!.id, {
      ...parsed.data,
      ...(categoryId !== undefined && { categoryId }),
      ...(imageUrls !== undefined && { imageUrls }),
    }).catch(handleOwnershipError);

    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
    res.json({ listing });
  } catch (err) {
    next(err);
  }
}

export async function deleteListingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await softDeleteListing(req.params.id, req.dbUser!.id).catch(
      handleOwnershipError,
    );
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function updateListingStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid status');
    }

    const result = await updateListingStatus(
      req.params.id,
      req.dbUser!.id,
      parsed.data.status as ListingStatus,
    ).catch(handleOwnershipError);

    if (!result) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
    res.json({ listing: result });
  } catch (err) {
    next(err);
  }
}

export async function getSellerListingsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sellerId = req.params.sellerId ?? req.dbUser!.id;
    const listings = await getSellerListings(sellerId);
    res.json({ listings });
  } catch (err) {
    next(err);
  }
}
