import { prisma } from "../db";
import { Role } from "@prisma/client";
import { compare, hash } from "bcryptjs";

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function countUsers() {
  return prisma.user.count();
}

export async function createUser(email: string, password: string, opts?: { role?: Role }) {
  const passwordHash = await hash(password, 10);
  return prisma.user.create({ data: { email, passwordHash, role: opts?.role ?? Role.USER } });
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

