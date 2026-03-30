import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
