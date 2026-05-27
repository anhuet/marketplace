import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { User } from '@prisma/client';

export class DisplayNameTakenError extends Error {
  constructor() {
    super('That display name is already in use');
    this.name = 'DisplayNameTakenError';
  }
}

async function generateUniqueRandomDisplayName(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `user${Math.floor(100000 + Math.random() * 900000)}`;
    const taken = await prisma.user.findFirst({
      where: { displayNameLower: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `user${Date.now().toString().slice(-6)}`;
}

export async function findOrCreateUser(auth0Id: string, email: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { auth0Id } });

  if (existing) {
    // Detect email-prefix displayName (PII leak) — replace with auto-generated
    // `userXXXXXX` and flag for re-setup so the user can pick a real name.
    if (
      existing.displayName !== null &&
      existing.email !== null &&
      existing.displayName === existing.email.split('@')[0] &&
      existing.needsDisplayNameSetup === false
    ) {
      const generated = await generateUniqueRandomDisplayName();
      return prisma.user.update({
        where: { auth0Id },
        data: {
          displayName: generated,
          displayNameLower: generated.toLowerCase(),
          needsDisplayNameSetup: true,
        },
      });
    }

    // Backfill blank email from Auth0 claims if missing. displayName is never
    // backfilled from Auth0 claims — we always use the auto-generated value
    // assigned at create time.
    if (!existing.email && email) {
      return prisma.user.update({
        where: { auth0Id },
        data: { email },
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

  // Create the user record with an auto-generated `userXXXXXX` display name as
  // a safe default. needsDisplayNameSetup stays true so the mobile app routes
  // the user through ProfileSetup, where the generated name is prefilled and
  // can be confirmed or changed.
  const generated = await generateUniqueRandomDisplayName();

  // Retry on the rare unique-index race (two concurrent registrations land on
  // the same random suffix between candidate generation and insert).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = attempt === 0 ? generated : await generateUniqueRandomDisplayName();
    try {
      return await prisma.user.create({
        data: {
          auth0Id,
          email,
          displayName: candidate,
          displayNameLower: candidate.toLowerCase(),
          needsDisplayNameSetup: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        Array.isArray(err.meta?.target) &&
        (err.meta.target as string[]).includes('display_name_lower')
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to generate a unique display name after multiple attempts');
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
