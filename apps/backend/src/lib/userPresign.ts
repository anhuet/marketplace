import { getPresignedUrl } from './s3';

/**
 * Presigns a single avatar URL.
 * Returns null if the input is null/undefined.
 * Falls back to the original URL if presigning fails (e.g. local dev without S3).
 */
export async function presignAvatarUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    return await getPresignedUrl(url);
  } catch {
    return url;
  }
}

/**
 * Returns a copy of the user object with `avatarUrl` presigned.
 * Generic so it works for full User rows and partial selects.
 * Returns null if the user is null.
 */
export async function presignUserAvatar<T extends { avatarUrl?: string | null }>(
  user: T | null,
): Promise<T | null> {
  if (!user) return null;
  const avatarUrl = await presignAvatarUrl(user.avatarUrl);
  return { ...user, avatarUrl };
}

/**
 * Returns a copy of each user object with `avatarUrl` presigned.
 * Uses Promise.all so all presign calls run in parallel.
 */
export async function presignManyUserAvatars<T extends { avatarUrl?: string | null }>(
  users: T[],
): Promise<T[]> {
  return Promise.all(users.map((u) => presignUserAvatar(u))) as Promise<T[]>;
}
