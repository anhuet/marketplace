import { prisma } from '../lib/prisma';
import { User } from '@prisma/client';

export async function findOrCreateUser(auth0Id: string, email: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { auth0Id } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      auth0Id,
      email,
      displayName: email.split('@')[0], // Temporary display name until profile setup
    },
  });
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByAuth0Id(auth0Id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { auth0Id } });
}
