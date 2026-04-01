import { prisma } from '../lib/prisma';
import { User } from '@prisma/client';
import { createInviteCodeForUser } from './inviteCodeService';

export async function findOrCreateUser(
  auth0Id: string,
  email: string,
  displayName?: string,
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { auth0Id } });
  if (existing) return existing;

  // Create the user record
  const user = await prisma.user.create({
    data: {
      auth0Id,
      email,
      displayName: displayName ?? email.split('@')[0],
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
