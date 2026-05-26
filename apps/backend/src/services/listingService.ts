import { prisma } from '../lib/prisma';
import { Prisma, ListingStatus, Condition } from '@prisma/client';
import { getPresignedUrl } from '../lib/s3';
import { presignAvatarUrl, presignManyUserAvatars } from '../lib/userPresign';

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
  buyer: {
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
 * short-lived presigned GET URL (1-hour TTL), and presigns seller/buyer
 * avatarUrls if present. Returns a new object — does not mutate the original.
 * Safe to call in dev environments without S3: if the URL does not match the
 * CDN_URL prefix, the original URL is returned unchanged.
 */
async function presignListingImages<
  T extends {
    images: { id: string; url: string; order: number }[];
    seller?: { avatarUrl?: string | null } | null;
    buyer?: { avatarUrl?: string | null } | null;
  },
>(listing: T): Promise<T> {
  const [images, seller, buyer] = await Promise.all([
    Promise.all(
      listing.images.map(async (img) => {
        let url = img.url;
        try {
          url = await getPresignedUrl(img.url);
        } catch {
          // fall back to stored URL if presigning fails
        }
        return { ...img, url };
      }),
    ),
    listing.seller
      ? { ...listing.seller, avatarUrl: await presignAvatarUrl(listing.seller.avatarUrl) }
      : listing.seller,
    listing.buyer
      ? { ...listing.buyer, avatarUrl: await presignAvatarUrl(listing.buyer.avatarUrl) }
      : listing.buyer,
  ]);
  return { ...listing, images, seller, buyer };
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

  const updated = await prisma.listing.update({
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

  return presignListingImages(updated);
}

export async function addListingImages(
  listingId: string,
  sellerId: string,
  newImageUrls: string[],
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { images: { select: { order: true } } },
  });
  if (!listing || listing.status === ListingStatus.DELETED) return null;
  if (listing.sellerId !== sellerId) throw new Error('FORBIDDEN');

  const currentCount = listing.images.length;
  const MAX_IMAGES = 8;
  if (currentCount + newImageUrls.length > MAX_IMAGES) {
    throw new Error(`EXCEEDS_MAX_IMAGES:${MAX_IMAGES}`);
  }

  const maxOrder = listing.images.reduce((max: number, img: { order: number }) => Math.max(max, img.order), -1);

  const created = await Promise.all(
    newImageUrls.map((url, idx) =>
      prisma.listingImage.create({
        data: { listingId, url, order: maxOrder + 1 + idx },
      }),
    ),
  );

  return Promise.all(
    created.map(async (img) => {
      let url = img.url;
      try {
        url = await getPresignedUrl(img.url);
      } catch {
        // fall back to stored URL
      }
      return { id: img.id, url, order: img.order };
    }),
  );
}

export async function deleteListingImage(
  listingId: string,
  imageId: string,
  sellerId: string,
): Promise<{ deletedUrl: string } | null> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { images: { select: { id: true, url: true, order: true } } },
  });
  if (!listing || listing.status === ListingStatus.DELETED) return null;
  if (listing.sellerId !== sellerId) throw new Error('FORBIDDEN');

  const image = listing.images.find((img: { id: string; url: string; order: number }) => img.id === imageId);
  if (!image) throw new Error('IMAGE_NOT_FOUND');

  if (listing.images.length <= 1) {
    throw new Error('LAST_IMAGE');
  }

  await prisma.listingImage.delete({ where: { id: imageId } });

  return { deletedUrl: image.url };
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

export async function updateListingStatus(id: string, sellerId: string, status: ListingStatus, buyerId?: string) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status === ListingStatus.DELETED) return null;
  if (listing.sellerId !== sellerId) throw new Error('FORBIDDEN');

  const updated = await prisma.listing.update({
    where: { id },
    data: { status, ...(buyerId !== undefined && { buyerId }) },
    include: listingInclude,
  });
  return presignListingImages(updated);
}

export async function getListingBuyers(listingId: string, sellerId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status === ListingStatus.DELETED) return null;
  if (listing.sellerId !== sellerId) throw new Error('FORBIDDEN');

  const conversations = await prisma.conversation.findMany({
    where: { listingId },
    include: {
      buyer: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return presignManyUserAvatars(conversations.map((c) => c.buyer));
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
