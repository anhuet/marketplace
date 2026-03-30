import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { Platform } from '@prisma/client';

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.nativeEnum(Platform),
});

export async function registerPushToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token, platform } = registerTokenSchema.parse(req.body);
    const userId = req.dbUser!.id;

    // Upsert: if token exists, update userId and timestamp
    await prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, updatedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deletePushToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = req.params;
    const userId = req.dbUser!.id;

    const existing = await prisma.pushToken.findUnique({ where: { token } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Push token not found');
    if (existing.userId !== userId)
      throw new AppError(403, 'FORBIDDEN', 'Token does not belong to you');

    await prisma.pushToken.delete({ where: { token } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
