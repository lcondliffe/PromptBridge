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
  const data: Prisma.UserCreateInput = {
    email,
    passwordHash,
    ...(opts?.role
      ? { role: opts.role as unknown as Prisma.UserCreateInput["role"] }
      : {}),
  };
  return prisma.user.create({ data });
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

