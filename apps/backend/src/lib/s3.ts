import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'eu-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET = process.env.S3_BUCKET ?? '';
const CDN_URL =
  process.env.CDN_URL ??
  `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'eu-west-1'}.amazonaws.com`;

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 80;

/**
 * Optimises an image buffer with sharp before uploading to S3.
 *
 * - Strips EXIF metadata (reduces size, removes GPS data)
 * - Auto-rotates based on EXIF orientation
 * - Resizes to fit within 1200×1200 (preserves aspect ratio, no upscale)
 * - Converts to JPEG at quality 80 (~70-80 % smaller than unoptimised originals)
 */
async function optimiseImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()                        // auto-rotate from EXIF
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export async function uploadImageToS3(
  buffer: Buffer,
  _originalName: string,
  _mimeType: string,
): Promise<string> {
  const optimised = await optimiseImage(buffer);
  const key = `listings/${randomUUID()}.jpg`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: optimised,
      ContentType: 'image/jpeg',
    }),
  );

  return `${CDN_URL}/${key}`;
}

export async function deleteImageFromS3(url: string): Promise<void> {
  const key = url.replace(`${CDN_URL}/`, '');
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Generates a presigned GET URL (1-hour TTL) for a private S3 object.
 *
 * If BUCKET or CDN_URL are not configured (e.g. local dev without S3), or if the
 * URL does not match the expected CDN_URL prefix, the original URL is returned
 * unchanged so dev environments without S3 do not break.
 */
export async function getPresignedUrl(objectUrl: string): Promise<string> {
  if (!BUCKET || !CDN_URL || !objectUrl.startsWith(`${CDN_URL}/`)) {
    return objectUrl;
  }

  const key = objectUrl.replace(`${CDN_URL}/`, '');
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}
