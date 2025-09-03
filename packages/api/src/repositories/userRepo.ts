import { prisma } from "../db";

// Get user by Clerk user ID
export async function getUserByClerkId(clerkUserId: string) {
  return prisma.user.findUnique({ where: { id: clerkUserId } });
}

// Create or update user from Clerk data
export async function syncClerkUser(
  clerkUserId: string,
  email: string,
  opts?: { role?: "ADMIN" | "USER" }
) {
  const existingUser = await getUserByClerkId(clerkUserId);
  if (existingUser) {
    // Update email if it changed
    if (existingUser.email !== email) {
      return prisma.user.update({
        where: { id: clerkUserId },
        data: { email }
      });
    }
    return existingUser;
  }
  
  // Create new user record with Clerk ID
  const role = opts?.role || "USER";
  return prisma.user.create({
    data: {
      id: clerkUserId,
      email,
      passwordHash: "", // Empty since Clerk handles authentication
      role
    }
  });
}

export async function countUsers() {
  return prisma.user.count();
}

// Legacy functions - deprecated with Clerk
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(
  email: string,
  password: string,
  opts?: { role?: "ADMIN" | "USER" }
) {
  throw new Error("createUser is deprecated - use Clerk for user creation");
}

export async function verifyPassword(password: string, passwordHash: string) {
  throw new Error("verifyPassword is deprecated - Clerk handles authentication");
}

