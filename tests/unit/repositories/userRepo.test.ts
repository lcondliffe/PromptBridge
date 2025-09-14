import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock the db import (must be at top level before other imports)
vi.mock('../../../packages/api/src/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { getUserByClerkId, syncClerkUser, countUsers } from '../../../packages/api/src/repositories/userRepo';
import { prisma } from '../../../packages/api/src/db';

// Get the mocked prisma for type assertion
const mockPrisma = prisma as any;

describe('userRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserByClerkId', () => {
    it('should find user by Clerk ID', async () => {
      const testClerkId = 'user_test_abc123';
      const expectedUser = {
        id: testClerkId,
        email: 'test@example.com',
        role: 'USER',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(expectedUser);

      const result = await getUserByClerkId(testClerkId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testClerkId },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      const testClerkId = 'user_nonexistent';
      (mockPrisma.user.findUnique as Mock).mockResolvedValue(null);

      const result = await getUserByClerkId(testClerkId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testClerkId },
      });
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const testClerkId = 'user_test_error';
      const dbError = new Error('Database connection failed');
      (mockPrisma.user.findUnique as Mock).mockRejectedValue(dbError);

      await expect(getUserByClerkId(testClerkId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('syncClerkUser', () => {
    it('should create new user when user does not exist', async () => {
      const testClerkId = 'user_test_new123';
      const testEmail = 'newuser@example.com';
      const newUser = {
        id: testClerkId,
        email: testEmail,
        role: 'USER',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(null);
      (mockPrisma.user.create as Mock).mockResolvedValue(newUser);

      const result = await syncClerkUser(testClerkId, testEmail);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testClerkId },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          id: testClerkId,
          email: testEmail,
          passwordHash: '',
          role: 'USER',
        },
      });
      expect(result).toEqual(newUser);
    });

    it('should create admin user when role is specified', async () => {
      const testClerkId = 'user_test_admin123';
      const testEmail = 'admin@example.com';
      const adminUser = {
        id: testClerkId,
        email: testEmail,
        role: 'ADMIN',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(null);
      (mockPrisma.user.create as Mock).mockResolvedValue(adminUser);

      const result = await syncClerkUser(testClerkId, testEmail, { role: 'ADMIN' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          id: testClerkId,
          email: testEmail,
          passwordHash: '',
          role: 'ADMIN',
        },
      });
      expect(result).toEqual(adminUser);
    });

    it('should update user email when it has changed', async () => {
      const testClerkId = 'user_test_existing123';
      const oldEmail = 'old@example.com';
      const newEmail = 'new@example.com';
      const existingUser = {
        id: testClerkId,
        email: oldEmail,
        role: 'USER',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedUser = { ...existingUser, email: newEmail };

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(existingUser);
      (mockPrisma.user.update as Mock).mockResolvedValue(updatedUser);

      const result = await syncClerkUser(testClerkId, newEmail);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testClerkId },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: testClerkId },
        data: { email: newEmail },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should return existing user when email has not changed', async () => {
      const testClerkId = 'user_test_unchanged123';
      const email = 'unchanged@example.com';
      const existingUser = {
        id: testClerkId,
        email: email,
        role: 'USER',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(existingUser);

      const result = await syncClerkUser(testClerkId, email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testClerkId },
      });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingUser);
    });

    it('should handle empty email gracefully', async () => {
      const testClerkId = 'user_test_noemail123';
      const testEmail = '';
      const newUser = {
        id: testClerkId,
        email: testEmail,
        role: 'USER',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(null);
      (mockPrisma.user.create as Mock).mockResolvedValue(newUser);

      const result = await syncClerkUser(testClerkId, testEmail);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          id: testClerkId,
          email: '',
          passwordHash: '',
          role: 'USER',
        },
      });
      expect(result).toEqual(newUser);
    });

    it('should handle database errors during user creation', async () => {
      const testClerkId = 'user_test_createerror';
      const testEmail = 'error@example.com';
      const dbError = new Error('Unique constraint violation');

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(null);
      (mockPrisma.user.create as Mock).mockRejectedValue(dbError);

      await expect(syncClerkUser(testClerkId, testEmail)).rejects.toThrow('Unique constraint violation');
    });

    it('should handle database errors during user update', async () => {
      const testClerkId = 'user_test_updateerror';
      const existingUser = {
        id: testClerkId,
        email: 'old@example.com',
        role: 'USER',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const dbError = new Error('Update failed');

      (mockPrisma.user.findUnique as Mock).mockResolvedValue(existingUser);
      (mockPrisma.user.update as Mock).mockRejectedValue(dbError);

      await expect(syncClerkUser(testClerkId, 'new@example.com')).rejects.toThrow('Update failed');
    });
  });

  describe('countUsers', () => {
    it('should return user count', async () => {
      const expectedCount = 42;
      (mockPrisma.user.count as Mock).mockResolvedValue(expectedCount);

      const result = await countUsers();

      expect(mockPrisma.user.count).toHaveBeenCalledWith();
      expect(result).toBe(expectedCount);
    });

    it('should return zero when no users exist', async () => {
      (mockPrisma.user.count as Mock).mockResolvedValue(0);

      const result = await countUsers();

      expect(mockPrisma.user.count).toHaveBeenCalledWith();
      expect(result).toBe(0);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Count query failed');
      (mockPrisma.user.count as Mock).mockRejectedValue(dbError);

      await expect(countUsers()).rejects.toThrow('Count query failed');
    });
  });
});