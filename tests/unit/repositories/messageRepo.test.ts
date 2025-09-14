import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock the db import (must be at top level before other imports)
vi.mock('../../../packages/api/src/db', () => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { listMessages, createMessage } from '../../../packages/api/src/repositories/messageRepo';
import { prisma } from '../../../packages/api/src/db';

// Get the mocked prisma for type assertion
const mockPrisma = prisma as any;

describe('messageRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listMessages', () => {
    it('should return messages for conversation owned by user', async () => {
      const testConversationId = 'conv_test_123';
      const testUserId = 'user_test_456';
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedMessages = [
        {
          id: 'msg_1',
          conversationId: testConversationId,
          role: 'user',
          content: 'Hello',
          model: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg_2',
          conversationId: testConversationId,
          role: 'assistant',
          content: 'Hi there!',
          model: 'gpt-3.5-turbo',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.findMany as Mock).mockResolvedValue(expectedMessages);

      const result = await listMessages(testConversationId, testUserId);

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: testConversationId },
      });
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: testConversationId },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(expectedMessages);
    });

    it('should return empty array when conversation not found', async () => {
      const testConversationId = 'conv_nonexistent';
      const testUserId = 'user_test';

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(null);

      const result = await listMessages(testConversationId, testUserId);

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: testConversationId },
      });
      expect(mockPrisma.message.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return empty array when user does not own conversation', async () => {
      const testConversationId = 'conv_not_owned';
      const testUserId = 'user_not_owner';
      const actualOwnerId = 'user_actual_owner';
      const conversation = {
        id: testConversationId,
        userId: actualOwnerId,
        title: 'Not Owned Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);

      const result = await listMessages(testConversationId, testUserId);

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: testConversationId },
      });
      expect(mockPrisma.message.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return empty array when conversation has no messages', async () => {
      const testConversationId = 'conv_empty';
      const testUserId = 'user_test';
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Empty Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.findMany as Mock).mockResolvedValue([]);

      const result = await listMessages(testConversationId, testUserId);

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: testConversationId },
      });
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: testConversationId },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([]);
    });

    it('should handle database errors during conversation lookup', async () => {
      const testConversationId = 'conv_error';
      const testUserId = 'user_test';
      const dbError = new Error('Database connection failed');

      (mockPrisma.conversation.findUnique as Mock).mockRejectedValue(dbError);

      await expect(listMessages(testConversationId, testUserId)).rejects.toThrow('Database connection failed');
      expect(mockPrisma.message.findMany).not.toHaveBeenCalled();
    });

    it('should handle database errors during message retrieval', async () => {
      const testConversationId = 'conv_msg_error';
      const testUserId = 'user_test';
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const dbError = new Error('Message query failed');

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.findMany as Mock).mockRejectedValue(dbError);

      await expect(listMessages(testConversationId, testUserId)).rejects.toThrow('Message query failed');
    });

    it('should handle messages with various role types', async () => {
      const testConversationId = 'conv_roles';
      const testUserId = 'user_test';
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Role Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const messagesWithRoles = [
        {
          id: 'msg_system',
          conversationId: testConversationId,
          role: 'system',
          content: 'You are a helpful assistant',
          model: null,
          createdAt: new Date('2024-01-01T09:59:00Z'),
        },
        {
          id: 'msg_user',
          conversationId: testConversationId,
          role: 'user',
          content: 'What is AI?',
          model: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg_assistant',
          conversationId: testConversationId,
          role: 'assistant',
          content: 'AI stands for Artificial Intelligence...',
          model: 'gpt-4',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.findMany as Mock).mockResolvedValue(messagesWithRoles);

      const result = await listMessages(testConversationId, testUserId);

      expect(result).toEqual(messagesWithRoles);
    });
  });

  describe('createMessage', () => {
    it('should create a user message in conversation owned by user', async () => {
      const testConversationId = 'conv_create';
      const testUserId = 'user_owner';
      const messageInput = {
        role: 'user' as const,
        content: 'Hello, how are you?',
      };
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedMessage = {
        id: 'msg_new',
        conversationId: testConversationId,
        role: 'user',
        content: 'Hello, how are you?',
        model: null,
        createdAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.create as Mock).mockResolvedValue(expectedMessage);

      const result = await createMessage(testConversationId, testUserId, messageInput);

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: testConversationId },
      });
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: testConversationId,
          role: 'user',
          content: 'Hello, how are you?',
        },
      });
      expect(result).toEqual(expectedMessage);
    });

    it('should create an assistant message with model', async () => {
      const testConversationId = 'conv_assistant';
      const testUserId = 'user_owner';
      const messageInput = {
        role: 'assistant' as const,
        content: 'I am doing well, thank you!',
        model: 'gpt-3.5-turbo',
      };
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Assistant Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedMessage = {
        id: 'msg_assistant',
        conversationId: testConversationId,
        role: 'assistant',
        content: 'I am doing well, thank you!',
        model: 'gpt-3.5-turbo',
        createdAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.create as Mock).mockResolvedValue(expectedMessage);

      const result = await createMessage(testConversationId, testUserId, messageInput);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: testConversationId,
          role: 'assistant',
          content: 'I am doing well, thank you!',
          model: 'gpt-3.5-turbo',
        },
      });
      expect(result).toEqual(expectedMessage);
    });

    it('should create system message without model', async () => {
      const testConversationId = 'conv_system';
      const testUserId = 'user_owner';
      const messageInput = {
        role: 'system' as const,
        content: 'You are a helpful assistant specialized in programming.',
      };
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'System Message Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedMessage = {
        id: 'msg_system',
        conversationId: testConversationId,
        role: 'system',
        content: 'You are a helpful assistant specialized in programming.',
        model: null,
        createdAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.create as Mock).mockResolvedValue(expectedMessage);

      const result = await createMessage(testConversationId, testUserId, messageInput);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: testConversationId,
          role: 'system',
          content: 'You are a helpful assistant specialized in programming.',
        },
      });
      expect(result).toEqual(expectedMessage);
    });

    it('should throw error when conversation not found', async () => {
      const testConversationId = 'conv_nonexistent';
      const testUserId = 'user_test';
      const messageInput = {
        role: 'user' as const,
        content: 'This should fail',
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(null);

      await expect(createMessage(testConversationId, testUserId, messageInput)).rejects.toThrow('Conversation not found');
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });

    it('should throw error when user does not own conversation', async () => {
      const testConversationId = 'conv_not_owned';
      const testUserId = 'user_not_owner';
      const actualOwnerId = 'user_actual_owner';
      const messageInput = {
        role: 'user' as const,
        content: 'Unauthorized access attempt',
      };
      const conversation = {
        id: testConversationId,
        userId: actualOwnerId,
        title: 'Not Owned Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);

      await expect(createMessage(testConversationId, testUserId, messageInput)).rejects.toThrow('Conversation not found');
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });

    it('should handle empty message content', async () => {
      const testConversationId = 'conv_empty_content';
      const testUserId = 'user_owner';
      const messageInput = {
        role: 'user' as const,
        content: '',
      };
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Empty Content Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedMessage = {
        id: 'msg_empty',
        conversationId: testConversationId,
        role: 'user',
        content: '',
        model: null,
        createdAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.create as Mock).mockResolvedValue(expectedMessage);

      const result = await createMessage(testConversationId, testUserId, messageInput);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: testConversationId,
          role: 'user',
          content: '',
        },
      });
      expect(result).toEqual(expectedMessage);
    });

    it('should handle very long message content', async () => {
      const testConversationId = 'conv_long_content';
      const testUserId = 'user_owner';
      const longContent = 'A'.repeat(10000); // Very long message
      const messageInput = {
        role: 'user' as const,
        content: longContent,
      };
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Long Content Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedMessage = {
        id: 'msg_long',
        conversationId: testConversationId,
        role: 'user',
        content: longContent,
        model: null,
        createdAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.create as Mock).mockResolvedValue(expectedMessage);

      const result = await createMessage(testConversationId, testUserId, messageInput);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: testConversationId,
          role: 'user',
          content: longContent,
        },
      });
      expect(result).toEqual(expectedMessage);
    });

    it('should handle database errors during conversation lookup', async () => {
      const testConversationId = 'conv_lookup_error';
      const testUserId = 'user_test';
      const messageInput = {
        role: 'user' as const,
        content: 'This will error',
      };
      const dbError = new Error('Conversation lookup failed');

      (mockPrisma.conversation.findUnique as Mock).mockRejectedValue(dbError);

      await expect(createMessage(testConversationId, testUserId, messageInput)).rejects.toThrow('Conversation lookup failed');
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during message creation', async () => {
      const testConversationId = 'conv_create_error';
      const testUserId = 'user_owner';
      const messageInput = {
        role: 'user' as const,
        content: 'Creation will fail',
      };
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Creation Error Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const dbError = new Error('Message creation failed');

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.create as Mock).mockRejectedValue(dbError);

      await expect(createMessage(testConversationId, testUserId, messageInput)).rejects.toThrow('Message creation failed');
    });

    it('should handle unicode content correctly', async () => {
      const testConversationId = 'conv_unicode';
      const testUserId = 'user_owner';
      const unicodeContent = 'Hello 👋 世界 🌍 How are you? ¿Cómo estás? Comment ça va?';
      const messageInput = {
        role: 'user' as const,
        content: unicodeContent,
      };
      const conversation = {
        id: testConversationId,
        userId: testUserId,
        title: 'Unicode Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedMessage = {
        id: 'msg_unicode',
        conversationId: testConversationId,
        role: 'user',
        content: unicodeContent,
        model: null,
        createdAt: new Date(),
      };

      (mockPrisma.conversation.findUnique as Mock).mockResolvedValue(conversation);
      (mockPrisma.message.create as Mock).mockResolvedValue(expectedMessage);

      const result = await createMessage(testConversationId, testUserId, messageInput);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: testConversationId,
          role: 'user',
          content: unicodeContent,
        },
      });
      expect(result).toEqual(expectedMessage);
    });
  });
});