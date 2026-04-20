import { prisma } from '../lib/prisma';
import { User } from '@prisma/client';
import { createInviteCodeForUser } from './inviteCodeService';

export async function findOrCreateUser(
  auth0Id: string,
  email: string,
  displayName?: string,
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { auth0Id } });

  // If user exists but has empty email/displayName (created before /userinfo fix), update them
  if (existing) {
    const needsUpdate = (!existing.email && email) || (!existing.displayName && displayName);
    if (needsUpdate) {
      return prisma.user.update({
        where: { auth0Id },
        data: {
          ...(email && !existing.email ? { email } : {}),
          ...(displayName && !existing.displayName ? { displayName } : {}),
        },
      });
    }
    return existing;
  }

  // If no user found by auth0Id, check if email already exists (e.g. tenant migration)
  // In that case, re-link the existing account to the new auth0Id instead of creating a duplicate.
  if (email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      return prisma.user.update({
        where: { email },
        data: { auth0Id },
      });
    }
  }

  // Create the user record
  const user = await prisma.user.create({
    data: {
      auth0Id,
      email,
      displayName: displayName ?? (email ? email.split('@')[0] : auth0Id.split('|')[1] ?? 'User'),
    },
  });

  // Auto-generate their invite code on first account creation
  await createInviteCodeForUser(user.id);

  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByAuth0Id(auth0Id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { auth0Id } });
}

export async function updateUser(
  id: string,
  data: { displayName?: string; avatarUrl?: string | null; bio?: string | null },
): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}
