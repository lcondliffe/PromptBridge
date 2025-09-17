import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock the db import (must be at top level before other imports)
vi.mock('../../../packages/api/src/db', () => ({
  prisma: {
    conversation: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { listConversationsByUserId, createConversationForUser, deleteConversation } from '../../../packages/api/src/repositories/conversationRepo';
import { prisma } from '../../../packages/api/src/db';

// Get the mocked prisma for type assertion
const mockPrisma = prisma as {
  conversation: {
    findMany: Mock;
    create: Mock;
    findUnique: Mock;
    delete: Mock;
  };
};

describe('conversationRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listConversationsByUserId', () => {
    it('should return conversations for a user ordered by updatedAt desc', async () => {
      const testUserId = 'user_test_123';
      const expectedConversations = [
        {
          id: 'conv_latest',
          userId: testUserId,
          title: 'Latest Conversation',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'conv_older',
          userId: testUserId,
          title: 'Older Conversation',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (mockPrisma.conversation.findMany as Mock).mockResolvedValue(expectedConversations);

      const result = await listConversationsByUserId(testUserId);

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(expectedConversations);
    });

    it('should return empty array when user has no conversations', async () => {
      const testUserId = 'user_no_conversations';
      (mockPrisma.conversation.findMany as Mock).mockResolvedValue([]);

      const result = await listConversationsByUserId(testUserId);

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const testUserId = 'user_error';
      const dbError = new Error('Database connection failed');
      (mockPrisma.conversation.findMany as Mock).mockRejectedValue(dbError);

      await expect(listConversationsByUserId(testUserId)).rejects.toThrow('Database connection failed');
    });

    it('should handle special characters in user ID', async () => {
      const testUserId = 'user_test_with-special_chars.123';
      const expectedConversations = [
        {
          id: 'conv_special',
          userId: testUserId,
          title: 'Special User Conversation',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.conversation.findMany as Mock).mockResolvedValue(expectedConversations);

      const result = await listConversationsByUserId(testUserId);

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(expectedConversations);
    });
  });

  describe('createConversationForUser', () => {
    it('should create a new conversation for user', async () => {
      const testUserId = 'user_test_456';
      const testTitle = 'Test Conversation';
      const expectedConversation = {
        id: 'conv_new_123',
        userId: testUserId,
        title: testTitle,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.create as Mock).mockResolvedValue(expectedConversation);

      const result = await createConversationForUser(testUserId, testTitle);

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: testUserId, title: testTitle },
      });
      expect(result).toEqual(expectedConversation);
    });

    it('should handle empty title', async () => {
      const testUserId = 'user_test_empty_title';
      const testTitle = '';
      const expectedConversation = {
        id: 'conv_empty_title',
        userId: testUserId,
        title: testTitle,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.create as Mock).mockResolvedValue(expectedConversation);

      const result = await createConversationForUser(testUserId, testTitle);

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: testUserId, title: '' },
      });
      expect(result).toEqual(expectedConversation);
    });

    it('should handle long titles', async () => {
      const testUserId = 'user_test_long_title';
      const longTitle = 'A'.repeat(500); // Very long title
      const expectedConversation = {
        id: 'conv_long_title',
        userId: testUserId,
        title: longTitle,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.create as Mock).mockResolvedValue(expectedConversation);

      const result = await createConversationForUser(testUserId, longTitle);

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: testUserId, title: longTitle },
      });
      expect(result).toEqual(expectedConversation);
    });

    it('should handle titles with special characters and unicode', async () => {
      const testUserId = 'user_test_unicode';
      const unicodeTitle = 'Conversation with 💬 emojis and Ñ characters';
      const expectedConversation = {
        id: 'conv_unicode',
        userId: testUserId,
        title: unicodeTitle,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.create as Mock).mockResolvedValue(expectedConversation);

      const result = await createConversationForUser(testUserId, unicodeTitle);

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: testUserId, title: unicodeTitle },
      });
      expect(result).toEqual(expectedConversation);
    });

    it('should handle database errors during creation', async () => {
      const testUserId = 'user_test_create_error';
      const testTitle = 'Error Conversation';
      const dbError = new Error('Foreign key constraint failed');

      (mockPrisma.conversation.create as Mock).mockRejectedValue(dbError);

      await expect(createConversationForUser(testUserId, testTitle)).rejects.toThrow('Foreign key constraint failed');
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation owned by user', async () => {
      const testConversationId = 'conv_to_delete';
      const testUserId = 'user_owner';
      const existingConversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Conversation to Delete',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(existingConversation);
      (mockPrisma.conversation.delete as Mock).mockResolvedValue(existingConversation);

      const result = await deleteConversation(testConversationId, testUserId);

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: testConversationId },
      });
      expect(mockPrisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: testConversationId },
      });
      expect(result).toEqual(existingConversation);
    });

    it('should throw error when conversation not found', async () => {
      const testConversationId = 'conv_nonexistent';
      const testUserId = 'user_test';

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(null);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow('Conversation not found');
      expect(mockPrisma.conversation.delete).not.toHaveBeenCalled();
    });

    it('should throw error when user does not own conversation', async () => {
      const testConversationId = 'conv_not_owned';
      const testUserId = 'user_not_owner';
      const otherUserId = 'user_actual_owner';
      const existingConversation = {
        id: testConversationId,
        userId: otherUserId, // Different user ID
        title: 'Not Owned Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(existingConversation);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow('Conversation not found');
      expect(mockPrisma.conversation.delete).not.toHaveBeenCalled();
    });

    it('should handle database errors during findUnique', async () => {
      const testConversationId = 'conv_find_error';
      const testUserId = 'user_test';
      const dbError = new Error('Database connection failed');

      (mockPrisma.conversation.findUnique as Mock).mockRejectedValue(dbError);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow('Database connection failed');
      expect(mockPrisma.conversation.delete).not.toHaveBeenCalled();
    });

    it('should handle database errors during delete', async () => {
      const testConversationId = 'conv_delete_error';
      const testUserId = 'user_test';
      const existingConversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Delete Error Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const deleteError = new Error('Constraint violation during delete');

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(existingConversation);
      (mockPrisma.conversation.delete as Mock).mockRejectedValue(deleteError);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow('Constraint violation during delete');
    });

    it('should handle edge case with empty conversation ID', async () => {
      const testConversationId = '';
      const testUserId = 'user_test';

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(null);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow('Conversation not found');
      expect(mockPrisma.conversation.delete).not.toHaveBeenCalled();
    });

    it('should handle edge case with empty user ID', async () => {
      const testConversationId = 'conv_test';
      const testUserId = '';
      const existingConversation = {
        id: testConversationId,
        userId: 'user_actual_owner',
        title: 'Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(existingConversation);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow('Conversation not found');
      expect(mockPrisma.conversation.delete).not.toHaveBeenCalled();
    });
  });
});