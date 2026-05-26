import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { User } from '@prisma/client';

export class DisplayNameTakenError extends Error {
  constructor() {
    super('That display name is already in use');
    this.name = 'DisplayNameTakenError';
  }
}

export async function findOrCreateUser(
  auth0Id: string,
  email: string,
  displayName?: string,
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { auth0Id } });

  if (existing) {
    // Detect email-prefix displayName (PII leak) — flag for re-setup
    if (
      existing.displayName !== null &&
      existing.email !== null &&
      existing.displayName === existing.email.split('@')[0] &&
      existing.needsDisplayNameSetup === false
    ) {
      return prisma.user.update({
        where: { auth0Id },
        data: {
          displayName: null,
          displayNameLower: null,
          needsDisplayNameSetup: true,
        },
      });
    }

    // Update blank email or displayName from Auth0 claims if missing
    const needsUpdate = (!existing.email && email) || (!existing.displayName && displayName);
    if (needsUpdate) {
      return prisma.user.update({
        where: { auth0Id },
        data: {
          ...(email && !existing.email ? { email } : {}),
          ...(displayName && !existing.displayName
            ? {
                displayName,
                displayNameLower: displayName.toLowerCase(),
                needsDisplayNameSetup: false,
              }
            : {}),
        },
      });
    }

    return existing;
  }

  // If no user found by auth0Id, check if email already exists (e.g. tenant migration)
  if (email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      return prisma.user.update({
        where: { email },
        data: { auth0Id },
      });
    }
  }

  // Create the user record — leave displayName NULL if not provided by Auth0.
  // The user must complete ProfileSetup to choose a real name.
  const providedName = displayName && displayName.trim() ? displayName.trim() : null;

  // A provided name might itself be an email prefix — detect and reject it
  const isEmailPrefix =
    providedName !== null &&
    email !== null &&
    email !== '' &&
    providedName === email.split('@')[0];

  return prisma.user.create({
    data: {
      auth0Id,
      email,
      displayName: isEmailPrefix ? null : providedName,
      displayNameLower: isEmailPrefix || !providedName ? null : providedName.toLowerCase(),
      needsDisplayNameSetup: isEmailPrefix || !providedName,
    },
  });
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByAuth0Id(auth0Id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { auth0Id } });
}

export async function updateUser(
  id: string,
  data: {
    displayName?: string | null;
    displayNameLower?: string | null;
    needsDisplayNameSetup?: boolean;
    avatarUrl?: string | null;
    bio?: string | null;
  },
): Promise<User> {
  try {
    return await prisma.user.update({ where: { id }, data });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      Array.isArray(err.meta?.target) &&
      (err.meta.target as string[]).includes('display_name_lower')
    ) {
      throw new DisplayNameTakenError();
    }
    throw err;
  }
}

/**
 * Case-insensitive availability check for a display name.
 * Excludes the given userId from the check so a user updating
 * their own name to the same value (different casing) does not
 * get a false conflict.
 */
export async function isDisplayNameAvailable(
  name: string,
  excludeUserId?: string,
): Promise<boolean> {
  const lower = name.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: {
      displayNameLower: lower,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return existing === null;
}
