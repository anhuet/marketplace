import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateInviteCode } from '../services/inviteCodeService';
import { prisma } from '../lib/prisma';

const validateCodeParamSchema = z.object({
  code: z.string().min(1),
});

/**
 * GET /api/v1/invites/validate/:code
 * Public endpoint — no auth required.
 * Returns whether an invite code is valid without revealing sensitive info.
 */
export async function validateCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = validateCodeParamSchema.parse(req.params);
    const result = await validateInviteCode(code);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/invites/mine
 * Authenticated — returns the current user's invite code.
 * Only active users (who have redeemed an invite code) have their own invite code.
 * Inactive users receive a 403.
 */
export async function getMyInviteCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.dbUser!.id;

    // Only active users have an invite code
    if (!req.dbUser!.inviteCodeUsedId) {
      res.status(403).json({
        error: {
          code: 'INVITE_CODE_REQUIRED',
          message: 'You must redeem an invite code before you can share your own',
        },
      });
      return;
    }

    const inviteCode = await prisma.inviteCode.findUnique({
      where: { createdById: userId },
    });

    if (!inviteCode) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Invite code not found' },
      });
      return;
    }

    res.json({
      code: inviteCode.code,
      usedAt: inviteCode.usedAt,
      isUsed: inviteCode.usedAt !== null,
    });
  } catch (err) {
    next(err);
  }
}
