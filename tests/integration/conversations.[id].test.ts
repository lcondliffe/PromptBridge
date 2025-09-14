import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { NextRequest } from 'next/server';
import { DELETE } from '../../src/app/api/conversations/[id]/route';
import { TestData } from "../utils/factories";

// Mock the API functions
const mockDeleteConversation = vi.fn();

vi.mock('@promptbridge/api', () => ({
  deleteConversation: mockDeleteConversation,
}));

// Mock Clerk authentication
const mockAuth = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: mockAuth,
}));

// Create a test server that wraps our Next.js route handler
function createTestServer(conversationId: string = 'test_conv_id') {
  return createServer(async (req, res) => {
    try {
      // Mock the context parameter that Next.js provides
      const ctx = {
        params: Promise.resolve({ id: conversationId }),
      };
      
      let response;
      if (req.method === 'DELETE') {
        response = await DELETE(req as any, ctx);
      } else {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
      
      const responseBody = await response.json();
      
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(responseBody));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
}

describe('/api/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DELETE /api/conversations/[id]', () => {
    it('should delete conversation owned by authenticated user', async () => {
      const testUserId = TestData.user.clerkId();
      const testConversationId = TestData.conversation.id();
      const deletedConversation = {
        id: testConversationId,
        title: TestData.conversation.title(),
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockResolvedValue(deletedConversation);

      const server = createTestServer(testConversationId);
      
      const response = await request(server)
        .delete('/')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toEqual({ ok: true });
      expect(mockAuth).toHaveBeenCalledOnce();
      expect(mockDeleteConversation).toHaveBeenCalledWith(testConversationId, testUserId);
      
      server.close();
    });

    it('should return 401 for unauthenticated user', async () => {
      const testConversationId = TestData.conversation.id();

      mockAuth.mockResolvedValue({ userId: null });

      const server = createTestServer(testConversationId);
      
      const response = await request(server)
        .delete('/')
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
      expect(mockDeleteConversation).not.toHaveBeenCalled();
      
      server.close();
    });

    it('should return 404 when conversation not found', async () => {
      const testUserId = TestData.user.clerkId();
      const nonexistentConversationId = 'nonexistent_conv';

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockRejectedValue(new Error('Conversation not found'));

      const server = createTestServer(nonexistentConversationId);
      
      const response = await request(server)
        .delete('/')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
      expect(mockDeleteConversation).toHaveBeenCalledWith(nonexistentConversationId, testUserId);
      
      server.close();
    });

    it('should return 404 when user does not own conversation', async () => {
      const testUserId = TestData.user.clerkId();
      const otherUserConversationId = TestData.conversation.id();

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockRejectedValue(new Error('Conversation not found')); // Repository throws this for ownership violations

      const server = createTestServer(otherUserConversationId);
      
      const response = await request(server)
        .delete('/')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
      expect(mockDeleteConversation).toHaveBeenCalledWith(otherUserConversationId, testUserId);
      
      server.close();
    });

    it('should handle various conversation ID formats', async () => {
      const testUserId = TestData.user.clerkId();
      const testCases = [
        'simple_id',
        'conv_with_numbers_123',
        'UPPERCASE_ID',
        'mixed_Case_ID_456',
        'id-with-hyphens',
        'id.with.dots',
        'very_long_conversation_id_with_many_characters_to_test_length_limits',
      ];

      for (const conversationId of testCases) {
        const deletedConversation = {
          id: conversationId,
          title: 'Test Conversation',
          userId: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockAuth.mockResolvedValue({ userId: testUserId });
        mockDeleteConversation.mockResolvedValue(deletedConversation);

        const server = createTestServer(conversationId);
        
        const response = await request(server)
          .delete('/')
          .expect(200);

        expect(response.body).toEqual({ ok: true });
        expect(mockDeleteConversation).toHaveBeenCalledWith(conversationId, testUserId);
        
        server.close();
        vi.clearAllMocks();
      }
    });

    it('should handle empty conversation ID', async () => {
      const testUserId = TestData.user.clerkId();
      const emptyId = '';

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockRejectedValue(new Error('Conversation not found'));

      const server = createTestServer(emptyId);
      
      const response = await request(server)
        .delete('/')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
      expect(mockDeleteConversation).toHaveBeenCalledWith(emptyId, testUserId);
      
      server.close();
    });

    it('should handle URL-encoded conversation IDs', async () => {
      const testUserId = TestData.user.clerkId();
      const originalId = 'conv with spaces';
      const encodedId = 'conv%20with%20spaces';
      const deletedConversation = {
        id: encodedId, // The ID as received by the handler
        title: 'Test Conversation',
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockResolvedValue(deletedConversation);

      const server = createTestServer(encodedId);
      
      const response = await request(server)
        .delete('/')
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(mockDeleteConversation).toHaveBeenCalledWith(encodedId, testUserId);
      
      server.close();
    });

    it('should handle database constraint errors', async () => {
      const testUserId = TestData.user.clerkId();
      const testConversationId = TestData.conversation.id();

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockRejectedValue(new Error('Foreign key constraint violation'));

      const server = createTestServer(testConversationId);
      
      const response = await request(server)
        .delete('/')
        .expect(404); // All errors from deleteConversation are treated as "not found"

      expect(response.body).toEqual({ error: 'Not found' });
      
      server.close();
    });

    it('should handle concurrent deletion attempts', async () => {
      const testUserId = TestData.user.clerkId();
      const testConversationId = TestData.conversation.id();
      const deletedConversation = {
        id: testConversationId,
        title: 'Test Conversation',
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First call succeeds, second call fails (already deleted)
      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation
        .mockResolvedValueOnce(deletedConversation)
        .mockRejectedValueOnce(new Error('Conversation not found'));

      const server1 = createTestServer(testConversationId);
      const server2 = createTestServer(testConversationId);
      
      // Make concurrent DELETE requests
      const [response1, response2] = await Promise.all([
        request(server1).delete('/'),
        request(server2).delete('/'),
      ]);

      // First should succeed, second should fail
      expect(response1.status).toBe(200);
      expect(response1.body).toEqual({ ok: true });
      
      expect(response2.status).toBe(404);
      expect(response2.body).toEqual({ error: 'Not found' });
      
      expect(mockDeleteConversation).toHaveBeenCalledTimes(2);
      
      server1.close();
      server2.close();
    });

    it('should handle authentication timeout', async () => {
      const testConversationId = TestData.conversation.id();

      mockAuth.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 100))
      );

      const server = createTestServer(testConversationId);
      
      await request(server)
        .delete('/')
        .expect(500);
      
      expect(mockDeleteConversation).not.toHaveBeenCalled();
      
      server.close();
    });

    it('should handle malformed user ID', async () => {
      const testConversationId = TestData.conversation.id();

      mockAuth.mockResolvedValue({ userId: null }); // Malformed auth response

      const server = createTestServer(testConversationId);
      
      const response = await request(server)
        .delete('/')
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
      expect(mockDeleteConversation).not.toHaveBeenCalled();
      
      server.close();
    });

    it('should handle extremely long conversation IDs', async () => {
      const testUserId = TestData.user.clerkId();
      const veryLongId = 'x'.repeat(1000); // Very long ID

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockRejectedValue(new Error('Conversation not found'));

      const server = createTestServer(veryLongId);
      
      const response = await request(server)
        .delete('/')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
      expect(mockDeleteConversation).toHaveBeenCalledWith(veryLongId, testUserId);
      
      server.close();
    });

    it('should handle special characters in conversation ID', async () => {
      const testUserId = TestData.user.clerkId();
      const specialCharId = 'conv_with_special!@#$%^&*()_chars';
      const deletedConversation = {
        id: specialCharId,
        title: 'Special Conversation',
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockResolvedValue(deletedConversation);

      const server = createTestServer(specialCharId);
      
      const response = await request(server)
        .delete('/')
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(mockDeleteConversation).toHaveBeenCalledWith(specialCharId, testUserId);
      
      server.close();
    });

    it('should handle unicode characters in conversation ID', async () => {
      const testUserId = TestData.user.clerkId();
      const unicodeId = 'conv_with_émojis_🚀_and_unicode_chars';
      const deletedConversation = {
        id: unicodeId,
        title: 'Unicode Conversation',
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockResolvedValue(deletedConversation);

      const server = createTestServer(unicodeId);
      
      const response = await request(server)
        .delete('/')
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(mockDeleteConversation).toHaveBeenCalledWith(unicodeId, testUserId);
      
      server.close();
    });

    it('should only allow DELETE method', async () => {
      const testConversationId = TestData.conversation.id();
      const server = createTestServer(testConversationId);

      // Test other HTTP methods
      await request(server).get('/').expect(405);
      await request(server).post('/').expect(405);
      await request(server).put('/').expect(405);
      await request(server).patch('/').expect(405);
      
      server.close();
    });

    it('should handle rapid sequential deletes', async () => {
      const testUserId = TestData.user.clerkId();
      const testConversationIds = [
        TestData.conversation.id(),
        TestData.conversation.id(),
        TestData.conversation.id(),
      ];

      mockAuth.mockResolvedValue({ userId: testUserId });
      
      // Mock successful deletion for each conversation
      testConversationIds.forEach((id, index) => {
        mockDeleteConversation.mockResolvedValueOnce({
          id,
          title: `Conversation ${index + 1}`,
          userId: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      // Delete conversations sequentially
      for (const conversationId of testConversationIds) {
        const server = createTestServer(conversationId);
        
        const response = await request(server)
          .delete('/')
          .expect(200);

        expect(response.body).toEqual({ ok: true });
        
        server.close();
      }

      expect(mockDeleteConversation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error response consistency', () => {
    it('should maintain consistent error response format', async () => {
      const testConversationId = TestData.conversation.id();

      // Test unauthorized error
      mockAuth.mockResolvedValue({ userId: null });

      const server1 = createTestServer(testConversationId);
      
      const response1 = await request(server1)
        .delete('/')
        .expect(401);

      expect(response1.body).toHaveProperty('error');
      expect(typeof response1.body.error).toBe('string');
      expect(Object.keys(response1.body)).toEqual(['error']);

      server1.close();

      // Test not found error
      const testUserId = TestData.user.clerkId();
      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockRejectedValue(new Error('Not found'));

      const server2 = createTestServer(testConversationId);
      
      const response2 = await request(server2)
        .delete('/')
        .expect(404);

      expect(response2.body).toHaveProperty('error');
      expect(typeof response2.body.error).toBe('string');
      expect(Object.keys(response2.body)).toEqual(['error']);

      server2.close();
    });

    it('should maintain consistent success response format', async () => {
      const testUserId = TestData.user.clerkId();
      const testConversationId = TestData.conversation.id();
      const deletedConversation = {
        id: testConversationId,
        title: 'Test Conversation',
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockDeleteConversation.mockResolvedValue(deletedConversation);

      const server = createTestServer(testConversationId);
      
      const response = await request(server)
        .delete('/')
        .expect(200);

      expect(response.body).toHaveProperty('ok');
      expect(typeof response.body.ok).toBe('boolean');
      expect(response.body.ok).toBe(true);
      expect(Object.keys(response.body)).toEqual(['ok']);
      
      server.close();
    });
  });
});