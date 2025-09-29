import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '../../src/app/api/conversations/route';
import { NextRequest } from 'next/server';

const { mockListConversationsByUserId, mockCreateConversationForUser, mockSyncClerkUser } = vi.hoisted(() => ({
  mockListConversationsByUserId: vi.fn(),
  mockCreateConversationForUser: vi.fn(),
  mockSyncClerkUser: vi.fn(),
}));

vi.mock('@promptbridge/api', () => ({
  listConversationsByUserId: mockListConversationsByUserId,
  createConversationForUser: mockCreateConversationForUser,
  syncClerkUser: mockSyncClerkUser,
}));

const { mockAuth, mockCurrentUser } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCurrentUser: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: mockAuth,
  currentUser: mockCurrentUser,
}));

describe('Conversations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/conversations', () => {
    it('should return conversations for authenticated user', async () => {
      const testUserId = 'user_123';
      const testEmail = 'test@example.com';
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      const testConversations = [
        {
          id: 'conv_1',
          title: 'Test Conversation',
          userId: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockListConversationsByUserId.mockResolvedValue(testConversations);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 'conv_1',
        title: 'Test Conversation',
        userId: testUserId,
      });
      expect(mockListConversationsByUserId).toHaveBeenCalledWith(testUserId);
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      mockCurrentUser.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return empty array when user has no conversations', async () => {
      const testUserId = 'user_123';
      const testEmail = 'test@example.com';
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockListConversationsByUserId.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe('POST /api/conversations', () => {
    it('should create new conversation for authenticated user', async () => {
      const testUserId = 'user_123';
      const testEmail = 'test@example.com';
      const testTitle = 'New Conversation';
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      const newConversation = {
        id: 'conv_new',
        title: testTitle,
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockCreateConversationForUser.mockResolvedValue(newConversation);

      const request = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: testTitle }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: 'conv_new',
        title: testTitle,
        userId: testUserId,
      });
      expect(mockCreateConversationForUser).toHaveBeenCalledWith(testUserId, testTitle);
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      mockCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should validate input and return 400 for invalid data', async () => {
      const testUserId = 'user_123';
      const testEmail = 'test@example.com';
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });

      const request = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Invalid input' });
    });
  });
});
