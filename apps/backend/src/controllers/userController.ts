import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { updateUser } from '../services/userService';

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(300).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

/**
 * PATCH /api/v1/users/me
 * Updates the authenticated user's own profile fields.
 * All fields are optional — only supplied fields are changed.
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
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details,
        },
      });
      return;
    }

    const { displayName, bio, avatarUrl } = parsed.data;

    // Only include keys that were explicitly provided in the request body
    const updateData: { displayName?: string; bio?: string | null; avatarUrl?: string | null } = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const updated = await updateUser(req.dbUser!.id, updateData);

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}
