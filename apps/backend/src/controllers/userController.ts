import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import {
  updateUser,
  isDisplayNameAvailable,
  DisplayNameTakenError,
} from '../services/userService';
import { uploadImageToS3WithKey } from '../lib/s3';
import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';
import { presignUserAvatar } from '../lib/userPresign';

// ---------------------------------------------------------------------------
// Shared display name validation
// ---------------------------------------------------------------------------

const RESERVED_NAMES = ['admin', 'support', 'marketplace', 'system', 'mod', 'moderator'];

/**
 * Regex: 3–30 chars; starts and ends with alphanumeric; allows alphanumeric,
 * dots, underscores, and hyphens in between (but not as first/last char).
 */
const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{1,28}[a-zA-Z0-9])?$/;

const displayNameSchema = z
  .string()
  .min(3, 'Display name must be at least 3 characters')
  .max(30, 'Display name must be at most 30 characters')
  .regex(
    DISPLAY_NAME_REGEX,
    'Display name may only contain letters, numbers, dots, underscores, and hyphens, and must not start or end with a special character',
  );

function isReservedName(name: string): boolean {
  return RESERVED_NAMES.includes(name.toLowerCase());
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/users/me
// ---------------------------------------------------------------------------

const updateMeSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z.string().max(300).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

/**
 * PATCH /api/v1/users/me
 * Updates the authenticated user's own profile fields.
 * RDS is the source of truth — no Auth0 Management API calls.
 * When displayName changes: validate → uniqueness check → DB write.
 * Auth required: Yes (requireAuth + attachUser)
 */
export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateMeSchema.safeParse(req.body);

    if (!parsed.success) {
      const details = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details },
      });
      return;
    }

    const { displayName, bio, avatarUrl } = parsed.data;
    const dbUser = req.dbUser!;

    // Reserved word check
    if (displayName !== undefined && isReservedName(displayName)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ field: 'displayName', message: 'That display name is not allowed' }],
        },
      });
      return;
    }

    // Case-insensitive uniqueness check
    if (displayName !== undefined) {
      const available = await isDisplayNameAvailable(displayName, dbUser.id);
      if (!available) {
        res.status(409).json({
          error: {
            code: 'DISPLAY_NAME_TAKEN',
            message: 'That display name is already in use',
          },
        });
        return;
      }
    }

    // Build DB update payload — only include fields that were explicitly supplied
    const updateData: Parameters<typeof updateUser>[1] = {};

    if (displayName !== undefined) {
      updateData.displayName = displayName;
      updateData.displayNameLower = displayName.toLowerCase();
      updateData.needsDisplayNameSetup = false;
    }
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    try {
      const updated = await updateUser(dbUser.id, updateData);
      res.json({ user: await presignUserAvatar(updated) });
    } catch (err) {
      if (err instanceof DisplayNameTakenError) {
        res.status(409).json({
          error: { code: 'DISPLAY_NAME_TAKEN', message: err.message },
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/users/check-displayname?name=<x>
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/check-displayname
 * Real-time availability check for a display name.
 * Always returns 200 — the `available` field communicates the result.
 * Auth required: Yes (requireAuth + attachUser)
 */
export async function checkDisplayName(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const name = req.query.name;

    if (typeof name !== 'string') {
      res.json({ available: false, reason: 'invalid_format' });
      return;
    }

    // Format validation
    if (name.length < 3 || name.length > 30 || !DISPLAY_NAME_REGEX.test(name)) {
      res.json({ available: false, reason: 'invalid_format' });
      return;
    }

    // Reserved word check
    if (isReservedName(name)) {
      res.json({ available: false, reason: 'reserved' });
      return;
    }

    const available = await isDisplayNameAvailable(name, req.dbUser!.id);
    if (!available) {
      res.json({ available: false, reason: 'taken' });
      return;
    }

    res.json({ available: true });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/users/me/avatar
// ---------------------------------------------------------------------------

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/v1/users/me/avatar
 * Uploads a new avatar image (multipart/form-data, field: `avatar`).
 * Flow: upload to S3 → persist URL to DB (RDS is the master).
 * Auth required: Yes (requireAuth + attachUser)
 */
export async function uploadMyAvatar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No avatar image provided');
    }

    if (file.size > MAX_AVATAR_SIZE) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Avatar image must not exceed 5 MB');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Only image files are accepted');
    }

    const dbUser = req.dbUser!;
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const s3Key = `avatars/${dbUser.id}/${randomUUID()}.${ext}`;

    // Upload to S3 then persist URL to DB
    const avatarUrl = await uploadImageToS3WithKey(file.buffer, s3Key);

    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: { avatarUrl },
    });

    res.json({ user: await presignUserAvatar(updated) });
  } catch (err) {
    next(err);
  }
}
