import { prisma } from '../lib/prisma';
import { randomBytes } from 'crypto';
import { InviteCode } from '@prisma/client';

function generateCode(): string {
  // Generate a URL-safe code: MKT-XXXX-XXXX format
  // Excludes ambiguous characters: 0, O, 1, I
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len: number): string =>
    Array.from(randomBytes(len))
      .map((b) => chars[b % chars.length])
      .join('');
  return `MKT-${part(4)}-${part(4)}`;
}

export async function createInviteCodeForUser(userId: string): Promise<InviteCode> {
  // Idempotent — return existing code if user already has one
  const existing = await prisma.inviteCode.findUnique({
    where: { createdById: userId },
  });
  if (existing) return existing;

  // Generate a unique code with collision retry (max 10 attempts)
  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();
    const collision = await prisma.inviteCode.findUnique({ where: { code } });
    if (!collision) {
      return prisma.inviteCode.create({
        data: { code, createdById: userId },
      });
    }
  }

  throw new Error('Failed to generate unique invite code after 10 attempts');
}

export async function validateInviteCode(
  code: string,
): Promise<{ valid: boolean; reason?: string }> {
  const inviteCode = await prisma.inviteCode.findUnique({ where: { code } });

  if (!inviteCode) {
    return { valid: false, reason: 'Invite code not found' };
  }

  if (inviteCode.usedAt !== null) {
    return { valid: false, reason: 'Invite code has already been used' };
  }

  return { valid: true };
}

export async function redeemInviteCode(code: string, newUserId: string): Promise<void> {
  const inviteCode = await prisma.inviteCode.findUnique({ where: { code } });

  if (!inviteCode || inviteCode.usedAt !== null) {
    throw new Error('Invalid or already used invite code');
  }

  // Prevent self-redemption
  if (inviteCode.createdById === newUserId) {
    throw new Error('You cannot use your own invite code');
  }

  // Mark code as used and link to the new user atomically
  await prisma.$transaction([
    prisma.inviteCode.update({
      where: { id: inviteCode.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: newUserId },
      data: { inviteCodeUsedId: inviteCode.id },
    }),
  ]);
}
