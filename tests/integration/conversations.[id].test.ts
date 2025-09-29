import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DELETE } from '../../src/app/api/conversations/[id]/route';
import { NextRequest } from 'next/server';

const { mockDeleteConversation } = vi.hoisted(() => ({
  mockDeleteConversation: vi.fn(),
}));

vi.mock('@promptbridge/api', () => ({
  deleteConversation: mockDeleteConversation,
}));

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: mockAuth,
}));

describe('Conversations [id] API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DELETE /api/conversations/[id]', () => {
    it('should delete conversation owned by authenticated user', async () => {
      const testUserId = 'user_123';
      const testConversationId = 'conv_123';
      const deletedConversation = {
        id: testConversationId,
        title: 'Test Conversation',
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockResolvedValue(deletedConversation);

      const request = new NextRequest(`http://localhost/api/conversations/${testConversationId}`, {
        method: 'DELETE',
      });

      const context = { params: Promise.resolve({ id: testConversationId }) };
      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });
      expect(mockDeleteConversation).toHaveBeenCalledWith(testConversationId, testUserId);
    });

    it('should return 401 for unauthenticated user', async () => {
      const testConversationId = 'conv_123';

      mockAuth.mockResolvedValue({ userId: null });

      const request = new NextRequest(`http://localhost/api/conversations/${testConversationId}`, {
        method: 'DELETE',
      });

      const context = { params: Promise.resolve({ id: testConversationId }) };
      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(mockDeleteConversation).not.toHaveBeenCalled();
    });

    it('should return 404 when conversation not found', async () => {
      const testUserId = 'user_123';
      const nonexistentConversationId = 'nonexistent_conv';

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockRejectedValue(new Error('Conversation not found'));

      const request = new NextRequest(`http://localhost/api/conversations/${nonexistentConversationId}`, {
        method: 'DELETE',
      });

      const context = { params: Promise.resolve({ id: nonexistentConversationId }) };
      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Not found' });
    });
  });
});
