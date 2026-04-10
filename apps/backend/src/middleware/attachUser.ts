import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { findOrCreateUser } from '../services/userService';

// Augment Express Request to include the resolved DB user.
// We use interface merging in the global scope to avoid the no-namespace rule.
declare module 'express-serve-static-core' {
  interface Request {
    dbUser?: User;
  }
}

/**
 * Must be used AFTER requireAuth middleware.
 * Looks up (or creates) the DB user record from the Auth0 token claims
 * and attaches it to req.dbUser.
 */
export async function attachUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth?.sub) {
      res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'No authenticated user' },
      });
      return;
    }

    const auth0Id = req.auth.sub;
    const rawEmail: unknown = req.auth['email'];
    const email = typeof rawEmail === 'string' ? rawEmail : '';

    const user = await findOrCreateUser(auth0Id, email);
    req.dbUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
