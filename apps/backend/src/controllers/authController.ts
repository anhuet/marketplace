import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  validateInviteCode,
  redeemInviteCode,
  createInviteCodeForUser,
} from '../services/inviteCodeService';
import { prisma } from '../lib/prisma';

const validateInviteSchema = z.object({
  code: z.string().min(1),
});

/**
 * POST /api/v1/auth/validate-invite
 * Called BEFORE the client redirects to Auth0 signup.
 * Validates the invite code is real and unused.
 * Does NOT redeem the code yet — redemption happens after Auth0 creates the account.
 * Auth required: No
 */
export async function validateInvite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { code } = validateInviteSchema.parse(req.body);
    const result = await validateInviteCode(code);

    if (!result.valid) {
      res.status(400).json({
        error: {
          code: 'INVALID_INVITE_CODE',
          message: result.reason ?? 'Invalid invite code',
        },
      });
      return;
    }

    res.json({ valid: true });
  } catch (err) {
    next(err);
  }
}

const redeemInviteSchema = z.object({
  code: z.string().min(1),
});

/**
 * POST /api/v1/auth/redeem-invite
 * Called after Auth0 creates the account and the user logs in for the first time.
 * Redeems the invite code and links it to the newly created DB user.
 * Auth required: Yes (requireAuth + attachUser)
 */
export async function redeemInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = redeemInviteSchema.parse(req.body);
    const userId = req.dbUser!.id;

    // Ensure this user has not already redeemed a code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { inviteCodeUsedId: true },
    });

    if (user?.inviteCodeUsedId) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'User has already redeemed an invite code' },
      });
      return;
    }

    try {
      await redeemInviteCode(code, userId);
    } catch (redeemErr: unknown) {
      const message = redeemErr instanceof Error ? redeemErr.message : 'Failed to redeem invite code';
      if (message.includes('your own invite code')) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message },
        });
        return;
      }
      throw redeemErr;
    }

    // Now that user is active, generate their own invite code to share
    await createInviteCodeForUser(userId);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's DB profile.
 * Auth required: Yes (requireAuth + attachUser)
 */
export function getMe(req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ user: req.dbUser });
  } catch (err) {
    next(err);
  }
}
