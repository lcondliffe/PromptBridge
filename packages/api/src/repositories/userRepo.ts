import { prisma } from "../db";
import { compare, hash } from "bcryptjs";

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function countUsers() {
  return prisma.user.count();
}

export async function createUser(
  email: string,
  password: string,
  opts?: { role?: "ADMIN" | "USER" }
) {
  const passwordHash = await hash(password, 10);
  // Build args without depending on generated Prisma field types
  const data = { email, passwordHash } as Record<string, unknown>;
  if (opts?.role) data.role = opts.role;
  return prisma.user.create({ data } as Parameters<typeof prisma.user.create>[0]);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

