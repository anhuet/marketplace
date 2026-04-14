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
 * Fetch user profile from Auth0 /userinfo endpoint using the access token.
 * Returns email and name when they are not present in the JWT claims.
 */
async function fetchAuth0UserInfo(accessToken: string): Promise<{ email: string; name: string }> {
  const domain = process.env.AUTH0_DOMAIN ?? '';
  return new Promise((resolve, reject) => {
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
          resolve({ email: parsed.email ?? '', name: parsed.name ?? parsed.nickname ?? '' });
        } catch {
          resolve({ email: '', name: '' });
        }
      });
    });
    req.on('error', () => resolve({ email: '', name: '' }));
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
    let name = typeof req.auth['name'] === 'string' ? req.auth['name'] : '';

    // Auth0 access tokens often omit email — fetch from /userinfo if needed
    if (!email) {
      const rawToken = req.headers.authorization?.replace('Bearer ', '') ?? '';
      const userInfo = await fetchAuth0UserInfo(rawToken);
      email = userInfo.email;
      name = userInfo.name;
    }

    const user = await findOrCreateUser(auth0Id, email, name || undefined);
    req.dbUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
