import { prisma } from '../lib/prisma';
import { Prisma, ListingStatus, Condition } from '@prisma/client';
import { getPresignedUrl } from '../lib/s3';

export interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  condition: Condition;
  latitude: number;
  longitude: number;
  categoryId: string;
  imageUrls: string[];
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  price?: number;
  condition?: Condition;
  latitude?: number;
  longitude?: number;
  categoryId?: string;
  imageUrls?: string[];
}

const listingInclude = {
  images: { orderBy: { order: 'asc' as const } },
  seller: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      averageRating: true,
      ratingCount: true,
    },
  },
  category: true,
};

/**
 * Replaces each stored S3 object URL in a listing's images array with a
 * short-lived presigned GET URL (1-hour TTL). Returns a new object — does not
 * mutate the original. Safe to call in dev environments without S3: if the URL
 * does not match the CDN_URL prefix, the original URL is returned unchanged.
 */
async function presignListingImages<
  T extends { images: { id: string; url: string; order: number }[] },
>(listing: T): Promise<T> {
  const images = await Promise.all(
    listing.images.map(async (img) => ({ ...img, url: await getPresignedUrl(img.url) })),
  );
  return { ...listing, images };
}

export async function createListing(sellerId: string, input: CreateListingInput) {
  const listing = await prisma.listing.create({
    data: {
      title: input.title,
      description: input.description,
      price: new Prisma.Decimal(input.price),
      condition: input.condition,
      latitude: input.latitude,
      longitude: input.longitude,
      categoryId: input.categoryId,
      sellerId,
      images: {
        create: input.imageUrls.map((url, index) => ({ url, order: index })),
      },
    },
    include: listingInclude,
  });
  return presignListingImages(listing);
}

export async function getListingById(id: string) {
  const listing = await prisma.listing.findFirst({
    where: { id, status: { not: ListingStatus.DELETED } },
    include: listingInclude,
  });
  if (!listing) return null;
  return presignListingImages(listing);
}

export async function updateListing(id: string, sellerId: string, input: UpdateListingInput) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status === ListingStatus.DELETED) return null;
  if (listing.sellerId !== sellerId) throw new Error('FORBIDDEN');

  const updated = await prisma.$transaction(async (tx) => {
    if (input.imageUrls !== undefined) {
      await tx.listingImage.deleteMany({ where: { listingId: id } });
      await tx.listingImage.createMany({
        data: input.imageUrls.map((url, index) => ({ listingId: id, url, order: index })),
      });
    }

    return tx.listing.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price !== undefined && { price: new Prisma.Decimal(input.price) }),
        ...(input.condition !== undefined && { condition: input.condition }),
        ...(input.latitude !== undefined && { latitude: input.latitude }),
        ...(input.longitude !== undefined && { longitude: input.longitude }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      },
      include: listingInclude,
    });
  });

  return presignListingImages(updated);
}

export async function softDeleteListing(id: string, sellerId: string) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status === ListingStatus.DELETED) return null;
  if (listing.sellerId !== sellerId) throw new Error('FORBIDDEN');

  return prisma.listing.update({
    where: { id },
    data: { status: ListingStatus.DELETED },
  });
}

export async function updateListingStatus(id: string, sellerId: string, status: ListingStatus) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status === ListingStatus.DELETED) return null;
  if (listing.sellerId !== sellerId) throw new Error('FORBIDDEN');

  return prisma.listing.update({
    where: { id },
    data: { status },
  });
}

export async function getSellerListings(sellerId: string) {
  const listings = await prisma.listing.findMany({
    where: { sellerId, status: { not: ListingStatus.DELETED } },
    include: {
      images: { orderBy: { order: 'asc' }, take: 1 },
      category: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(listings.map(presignListingImages));
}
