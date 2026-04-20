import { prisma } from '../lib/prisma';

export async function saveListing(userId: string, listingId: string) {
  // Verify listing exists and is not deleted
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status === 'DELETED') throw new Error('NOT_FOUND');

  try {
    return await prisma.savedListing.create({
      data: { userId, listingId },
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new Error('ALREADY_SAVED');
    }
    throw err;
  }
}

export async function unsaveListing(userId: string, listingId: string) {
  const saved = await prisma.savedListing.findUnique({
    where: { userId_listingId: { userId, listingId } },
  });
  if (!saved) throw new Error('NOT_FOUND');

  await prisma.savedListing.delete({
    where: { id: saved.id },
  });
}

export async function getSavedListings(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [items, total] = await prisma.$transaction([
    prisma.savedListing.findMany({
      where: { userId },
      include: {
        listing: {
          include: {
            images: { orderBy: { order: 'asc' }, take: 1 },
            seller: {
              select: { id: true, displayName: true, avatarUrl: true, averageRating: true, ratingCount: true },
            },
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.savedListing.count({ where: { userId } }),
  ]);

  // Filter out deleted listings from results
  const filtered = items.filter((s) => s.listing.status !== 'DELETED');

  return {
    savedListings: filtered,
    total,
    page,
    limit,
    hasMore: offset + items.length < total,
  };
}

export async function isListingSaved(userId: string, listingId: string): Promise<boolean> {
  const saved = await prisma.savedListing.findUnique({
    where: { userId_listingId: { userId, listingId } },
  });
  return !!saved;
}

export async function getSavedListingIds(userId: string): Promise<string[]> {
  const saved = await prisma.savedListing.findMany({
    where: { userId },
    select: { listingId: true },
  });
  return saved.map((s) => s.listingId);
}
