import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { getPresignedUrl } from '../lib/s3';

export interface NearbyListingsInput {
  lat: number;
  lng: number;
  radiusKm: number;
  categoryId?: string;
  q?: string;
  page: number;
  limit: number;
}

export interface NearbyListing {
  id: string;
  title: string;
  description: string;
  price: string;
  condition: string;
  status: string;
  latitude: number;
  longitude: number;
  categoryId: string;
  sellerId: string;
  createdAt: Date;
  updatedAt: Date;
  distanceKm: number;
  coverImageUrl: string | null;
  sellerDisplayName: string;
  sellerAverageRating: number;
  categoryName: string;
  categorySlug: string;
}

export async function getNearbyListings(input: NearbyListingsInput): Promise<{
  listings: NearbyListing[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const { lat, lng, radiusKm, categoryId, q, page, limit } = input;

  // Bounding box pre-filter to narrow candidates before Haversine
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  const offset = (page - 1) * limit;

  // Build optional filter fragments
  const categoryFilter = categoryId
    ? Prisma.sql`AND l.category_id = ${categoryId}::uuid`
    : Prisma.empty;

  const keywordFilter = q
    ? Prisma.sql`AND (l.title ILIKE ${'%' + q + '%'} OR l.description ILIKE ${'%' + q + '%'})`
    : Prisma.empty;

  // LEAST(1.0, ...) guards against floating-point precision errors that produce
  // values slightly above 1.0, which would cause acos() to return NaN.
  const haversineExpr = Prisma.sql`
    (6371 * acos(
      LEAST(1.0, cos(radians(${lat})) * cos(radians(l.latitude))
      * cos(radians(l.longitude) - radians(${lng}))
      + sin(radians(${lat})) * sin(radians(l.latitude)))
    ))
  `;

  // Count query for pagination metadata
  const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM listings l
    WHERE
      l.status = 'ACTIVE'
      AND l.latitude  BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND l.longitude BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
      ${categoryFilter}
      ${keywordFilter}
      AND ${haversineExpr} <= ${radiusKm}
  `;

  const total = Number(countResult[0].count);

  // Main query: join seller and category, include cover image via correlated subquery
  const rows = await prisma.$queryRaw<NearbyListing[]>`
    SELECT
      l.id,
      l.title,
      l.description,
      l.price::text AS price,
      l.condition,
      l.status,
      l.latitude,
      l.longitude,
      l.category_id AS "categoryId",
      l.seller_id   AS "sellerId",
      l.created_at  AS "createdAt",
      l.updated_at  AS "updatedAt",
      ${haversineExpr} AS "distanceKm",
      (
        SELECT li.url
        FROM listing_images li
        WHERE li.listing_id = l.id
        ORDER BY li.order ASC
        LIMIT 1
      ) AS "coverImageUrl",
      u.display_name     AS "sellerDisplayName",
      u.average_rating   AS "sellerAverageRating",
      c.name             AS "categoryName",
      c.slug             AS "categorySlug"
    FROM listings l
    JOIN users      u ON u.id = l.seller_id
    JOIN categories c ON c.id = l.category_id
    WHERE
      l.status = 'ACTIVE'
      AND l.latitude  BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND l.longitude BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
      ${categoryFilter}
      ${keywordFilter}
      AND ${haversineExpr} <= ${radiusKm}
    ORDER BY "distanceKm" ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const listings = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      coverImageUrl: row.coverImageUrl ? await getPresignedUrl(row.coverImageUrl) : null,
    })),
  );

  return {
    listings,
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}
