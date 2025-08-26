import { prisma } from "../db";
import { compare, hash } from "bcryptjs";

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(email: string, password: string) {
  const passwordHash = await hash(password, 10);
  return prisma.user.create({ data: { email, passwordHash } });
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

