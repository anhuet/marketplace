import dotenv from 'dotenv';
dotenv.config();

// Construct DATABASE_URL from individual Secrets Manager env vars if not already set
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  process.env.DATABASE_URL = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT ?? 5432}/${process.env.DB_NAME}`;
}

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import jwksRsa from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { handleAuthError } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import router from './routes/index';

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ?? 3000;

// Socket.io — shares the same HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  },
});

// Attach io instance so controllers can emit events via req.app.get('io')
app.set('io', io);

// Auth0 JWKS client for Socket.io token validation
const jwksClient = jwksRsa({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

async function verifyAuth0Token(token: string): Promise<{ sub: string } | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') return null;
    const kid = decoded.header.kid;
    const key = await jwksClient.getSigningKey(kid);
    const publicKey = key.getPublicKey();
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    }) as { sub: string };
    return payload;
  } catch {
    return null;
  }
}

// Socket.io authentication + room joining
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    next(new Error('Authentication required'));
    return;
  }
  const payload = await verifyAuth0Token(token);
  if (!payload) {
    next(new Error('Invalid token'));
    return;
  }
  socket.data.auth0Id = payload.sub;
  next();
});

io.on('connection', async (socket) => {
  const auth0Id = socket.data.auth0Id as string;

  // Import prisma lazily to avoid circular deps
  const { prisma } = await import('./lib/prisma');

  const user = await prisma.user.findUnique({ where: { auth0Id } });
  if (!user) {
    socket.disconnect();
    return;
  }

  socket.data.userId = user.id;

  // Join all active conversation rooms for this user
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }],
    },
    select: { id: true },
  });
  conversations.forEach((c) => socket.join(`conversation:${c.id}`));

  // Allow client to join a specific conversation room (after starting one)
  socket.on('join_conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('disconnect', () => {
    // cleanup handled automatically by socket.io
  });
});

// Express middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/v1', router);

// Error handling (must be last)
app.use(handleAuthError);
app.use(errorHandler);

httpServer.listen(PORT, () => {
  if (process.env.NODE_ENV === 'development') {
    process.stdout.write(`[server] Running on http://localhost:${PORT}\n`);
  }
});

export { io };
export default app;
