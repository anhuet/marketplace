import { prisma } from '../lib/prisma';
import { ListingStatus } from '@prisma/client';

export async function createReview(input: {
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
}) {
  // Verify listing exists and is SOLD
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) throw new Error('NOT_FOUND');
  if (listing.status !== ListingStatus.SOLD) throw new Error('NOT_SOLD');

  // Verify reviewer is a participant (buyer or seller)
  const isSeller = listing.sellerId === input.reviewerId;
  const isBuyer = await prisma.conversation.findFirst({
    where: { listingId: input.listingId, buyerId: input.reviewerId },
  });
  if (!isSeller && !isBuyer) throw new Error('FORBIDDEN');

  // Prevent self-review
  if (input.reviewerId === input.revieweeId) throw new Error('SELF_REVIEW');

  // Insert review + update cached rating atomically
  return prisma.$transaction(async (tx) => {
    let review;
    try {
      review = await tx.review.create({
        data: {
          listingId: input.listingId,
          reviewerId: input.reviewerId,
          revieweeId: input.revieweeId,
          rating: input.rating,
          comment: input.comment,
        },
      });
    } catch (err: unknown) {
      // Handle unique constraint violation (duplicate review)
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new Error('DUPLICATE');
      }
      throw err;
    }

    // Recalculate average from DB (accurate, avoids incremental drift)
    const agg = await tx.review.aggregate({
      where: { revieweeId: input.revieweeId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.user.update({
      where: { id: input.revieweeId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });

    return review;
  });
}

export async function getUserReviews(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [reviews, total] = await prisma.$transaction([
    prisma.review.findMany({
      where: { revieweeId: userId },
      include: {
        reviewer: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.review.count({ where: { revieweeId: userId } }),
  ]);

  return {
    reviews,
    total,
    page,
    limit,
    hasMore: offset + reviews.length < total,
  };
}

export async function getUserRating(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { averageRating: true, ratingCount: true },
  });
  return user;
}
