import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE ?? '';

export const requireAuth = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
  }) as jwksRsa.GetVerificationKey,
  audience: AUTH0_AUDIENCE,
  issuer: `https://${AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
});

// Extend Express Request type to include auth payload
declare global {
  namespace Express {
    interface Request {
      auth?: {
        sub: string;
        email?: string;
        [key: string]: unknown;
      };
    }
  }
}

// Handle JWT errors gracefully
export function handleAuthError(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Invalid or missing authentication token',
      },
    });
    return;
  }
  next(err);
}
