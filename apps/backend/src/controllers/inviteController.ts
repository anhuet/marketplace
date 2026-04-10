import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createInviteCodeForUser, validateInviteCode } from '../services/inviteCodeService';

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
 * The code is auto-generated on account creation, so it always exists.
 * Uses createInviteCodeForUser which is idempotent and returns the existing code.
 */
export async function getMyInviteCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.dbUser!.id;
    const inviteCode = await createInviteCodeForUser(userId); // idempotent — returns existing
    res.json({
      code: inviteCode.code,
      usedAt: inviteCode.usedAt,
      isUsed: inviteCode.usedAt !== null,
    });
  } catch (err) {
    next(err);
  }
}
