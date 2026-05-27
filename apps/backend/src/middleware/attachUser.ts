import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import https from 'https';
import { findOrCreateUser } from '../services/userService';

declare module 'express-serve-static-core' {
  interface Request {
    dbUser?: User;
  }
}

/**
 * Fetch the email claim from Auth0 /userinfo endpoint using the access token.
 * Needed because Auth0 access tokens often omit `email` from JWT claims.
 */
async function fetchAuth0UserEmail(accessToken: string): Promise<string> {
  const domain = process.env.AUTH0_DOMAIN ?? '';
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      path: '/userinfo',
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.email ?? '');
        } catch {
          resolve('');
        }
      });
    });
    req.on('error', () => resolve(''));
    req.end();
  });
}

/**
 * Must be used AFTER requireAuth middleware.
 * Looks up (or creates) the DB user record from the Auth0 token claims.
 * If email is missing from the JWT (common with Auth0 access tokens),
 * fetches it from the /userinfo endpoint.
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
    let email = typeof req.auth['email'] === 'string' ? req.auth['email'] : '';

    // Auth0 access tokens often omit email — fetch from /userinfo if needed
    if (!email) {
      const rawToken = req.headers.authorization?.replace('Bearer ', '') ?? '';
      email = await fetchAuth0UserEmail(rawToken);
    }

    const user = await findOrCreateUser(auth0Id, email);
    req.dbUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
