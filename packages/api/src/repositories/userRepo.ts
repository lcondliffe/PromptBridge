import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
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
  // Base create input (role will be injected dynamically to avoid type coupling in CI)
  let data = { email, passwordHash } as unknown as Prisma.UserCreateInput;
  if (opts?.role) {
    (data as unknown as Record<string, unknown>).role = opts.role;
  }
  return prisma.user.create({ data });
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

