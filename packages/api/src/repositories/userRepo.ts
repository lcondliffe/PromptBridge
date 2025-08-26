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
  // Use a relaxed type here to avoid coupling to generated client enum at typecheck time
  const data: any = { email, passwordHash };
  if (opts?.role) data.role = opts.role;
  return prisma.user.create({ data });
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

