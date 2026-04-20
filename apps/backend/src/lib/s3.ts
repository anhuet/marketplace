import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';

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

export async function uploadImageToS3(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const key = `listings/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
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
