import { Request, Response, NextFunction } from 'express';

/**
 * Must be used AFTER attachUser middleware.
 * Rejects the request if the authenticated user has not redeemed an invite code.
 * Users without a redeemed invite code are considered inactive and cannot
 * perform seller actions (e.g. creating listings).
 */
export function requireActiveUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.dbUser) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'No authenticated user' },
    });
    return;
  }

  if (!req.dbUser.inviteCodeUsedId) {
    res.status(403).json({
      error: {
        code: 'INVITE_CODE_REQUIRED',
        message: 'You must redeem an invite code before you can sell items',
      },
    });
    return;
  }

  next();
}
