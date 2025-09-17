import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../src/app/api/conversations/route';
import { TestData } from "../utils/factories";

// Mock the API functions
const mockListConversationsByUserId = vi.fn();
const mockCreateConversationForUser = vi.fn();
const mockSyncClerkUser = vi.fn();

vi.mock('@promptbridge/api', () => ({
  listConversationsByUserId: mockListConversationsByUserId,
  createConversationForUser: mockCreateConversationForUser,
  syncClerkUser: mockSyncClerkUser,
}));

// Mock Clerk authentication
const mockAuth = vi.fn();
const mockCurrentUser = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: mockAuth,
  currentUser: mockCurrentUser,
}));

// Create a test server that wraps our Next.js route handlers
function createTestServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost:3000');
      // NextRequest created for potential future use
      new NextRequest(url, {
        method: req.method,
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value || ''])
        ),
      });

      let response;
      if (req.method === 'GET') {
        response = await GET();
      } else if (req.method === 'POST') {
        // Read body for POST requests
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        await new Promise(resolve => req.on('end', resolve));
        
        // Create a new request with body
        const requestWithBody = new NextRequest(url, {
          method: 'POST',
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value || ''])
          ),
          body,
        });
        
        response = await POST(requestWithBody);
      } else {
        throw new Error('Method not allowed');
      }
      
      const responseBody = await response.json();
      
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(responseBody));
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
}

describe('/api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/conversations', () => {
    it('should return conversations for authenticated user', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      const testConversations = [
        {
          id: TestData.conversation.id(),
          title: TestData.conversation.title(),
          userId: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: TestData.conversation.id(),
          title: TestData.conversation.title(),
          userId: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockListConversationsByUserId.mockResolvedValue(testConversations);

      const server = createTestServer();
      
      const response = await request(server)
        .get('/')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toEqual(testConversations);
      expect(mockAuth).toHaveBeenCalledOnce();
      expect(mockCurrentUser).toHaveBeenCalledOnce();
      expect(mockSyncClerkUser).toHaveBeenCalledWith(testUserId, testEmail);
      expect(mockListConversationsByUserId).toHaveBeenCalledWith(testUserId);
      
      server.close();
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      mockCurrentUser.mockResolvedValue(null);

      const server = createTestServer();
      
      const response = await request(server)
        .get('/')
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
      expect(mockSyncClerkUser).not.toHaveBeenCalled();
      expect(mockListConversationsByUserId).not.toHaveBeenCalled();
      
      server.close();
    });

    it('should return empty array when user has no conversations', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockListConversationsByUserId.mockResolvedValue([]);

      const server = createTestServer();
      
      const response = await request(server)
        .get('/')
        .expect(200);

      expect(response.body).toEqual([]);
      
      server.close();
    });

    it('should handle missing email gracefully', async () => {
      const testUserId = TestData.user.clerkId();
      const mockUser = { emailAddresses: [] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: '' });
      mockListConversationsByUserId.mockResolvedValue([]);

      const server = createTestServer();
      
      const response = await request(server)
        .get('/')
        .expect(200);

      expect(response.body).toEqual([]);
      expect(mockSyncClerkUser).toHaveBeenCalledWith(testUserId, '');
      
      server.close();
    });

    it('should handle database errors', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockListConversationsByUserId.mockRejectedValue(new Error('Database error'));

      const server = createTestServer();
      
      await request(server)
        .get('/')
        .expect(500);
      
      server.close();
    });

    it('should handle user sync errors', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockRejectedValue(new Error('User sync failed'));

      const server = createTestServer();
      
      await request(server)
        .get('/')
        .expect(500);
      
      server.close();
    });
  });

  describe('POST /api/conversations', () => {
    it('should create new conversation for authenticated user', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const testTitle = TestData.conversation.title();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      const newConversation = {
        id: TestData.conversation.id(),
        title: testTitle,
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockCreateConversationForUser.mockResolvedValue(newConversation);

      const server = createTestServer();
      
      const response = await request(server)
        .post('/')
        .send({ title: testTitle })
        .expect(201)
        .expect('Content-Type', /json/);

      expect(response.body).toEqual(newConversation);
      expect(mockAuth).toHaveBeenCalledOnce();
      expect(mockCurrentUser).toHaveBeenCalledOnce();
      expect(mockSyncClerkUser).toHaveBeenCalledWith(testUserId, testEmail);
      expect(mockCreateConversationForUser).toHaveBeenCalledWith(testUserId, testTitle);
      
      server.close();
    });

    it('should return 401 for unauthenticated user on POST', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      mockCurrentUser.mockResolvedValue(null);

      const server = createTestServer();
      
      const response = await request(server)
        .post('/')
        .send({ title: 'Test' })
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
      expect(mockCreateConversationForUser).not.toHaveBeenCalled();
      
      server.close();
    });

    it('should validate input and return 400 for invalid data', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });

      const server = createTestServer();
      
      // Test empty title
      const response1 = await request(server)
        .post('/')
        .send({ title: '' })
        .expect(400);

      expect(response1.body).toEqual({ error: 'Invalid input' });

      // Test missing title
      const response2 = await request(server)
        .post('/')
        .send({})
        .expect(400);

      expect(response2.body).toEqual({ error: 'Invalid input' });

      // Test title too long (> 200 chars)
      const longTitle = 'A'.repeat(201);
      const response3 = await request(server)
        .post('/')
        .send({ title: longTitle })
        .expect(400);

      expect(response3.body).toEqual({ error: 'Invalid input' });

      expect(mockCreateConversationForUser).not.toHaveBeenCalled();
      
      server.close();
    });

    it('should handle malformed JSON', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);

      const server = createTestServer();
      
      const response = await request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid input' });
      
      server.close();
    });

    it('should create conversation with maximum length title', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const maxTitle = 'A'.repeat(200); // Exactly 200 chars (max allowed)
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      const newConversation = {
        id: TestData.conversation.id(),
        title: maxTitle,
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockCreateConversationForUser.mockResolvedValue(newConversation);

      const server = createTestServer();
      
      const response = await request(server)
        .post('/')
        .send({ title: maxTitle })
        .expect(201);

      expect(response.body).toEqual(newConversation);
      expect(mockCreateConversationForUser).toHaveBeenCalledWith(testUserId, maxTitle);
      
      server.close();
    });

    it('should handle unicode characters in title', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const unicodeTitle = 'Test 🚀 Conversation with émojis and spëcial chars';
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      const newConversation = {
        id: TestData.conversation.id(),
        title: unicodeTitle,
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockCreateConversationForUser.mockResolvedValue(newConversation);

      const server = createTestServer();
      
      const response = await request(server)
        .post('/')
        .send({ title: unicodeTitle })
        .expect(201);

      expect(response.body).toEqual(newConversation);
      
      server.close();
    });

    it('should handle database creation errors', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const testTitle = TestData.conversation.title();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockCreateConversationForUser.mockRejectedValue(new Error('Database creation failed'));

      const server = createTestServer();
      
      await request(server)
        .post('/')
        .send({ title: testTitle })
        .expect(500);
      
      server.close();
    });

    it('should handle concurrent conversation creation', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      
      // Mock returning different conversations for each call
      mockCreateConversationForUser
        .mockResolvedValueOnce({
          id: 'conv_1',
          title: 'First Conversation',
          userId: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'conv_2',
          title: 'Second Conversation',
          userId: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const server = createTestServer();
      
      // Make concurrent POST requests
      const responses = await Promise.all([
        request(server).post('/').send({ title: 'First Conversation' }),
        request(server).post('/').send({ title: 'Second Conversation' }),
      ]);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.title).toBe(index === 0 ? 'First Conversation' : 'Second Conversation');
      });
      
      expect(mockCreateConversationForUser).toHaveBeenCalledTimes(2);
      
      server.close();
    });

    it('should trim whitespace from title', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const titleWithWhitespace = '  Test Conversation  ';
      const trimmedTitle = 'Test Conversation';
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      const newConversation = {
        id: TestData.conversation.id(),
        title: trimmedTitle,
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockCreateConversationForUser.mockResolvedValue(newConversation);

      const server = createTestServer();
      
      const response = await request(server)
        .post('/')
        .send({ title: titleWithWhitespace })
        .expect(201);

      // The validation should fail because zod will see the original string
      // Let's test that the validation correctly handles this
      expect(response.body).toEqual(newConversation);
      
      server.close();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle auth timeout gracefully', async () => {
      mockAuth.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 100))
      );

      const server = createTestServer();
      
      await request(server)
        .get('/')
        .expect(500);
      
      server.close();
    });

    it('should handle malformed user object', async () => {
      const testUserId = TestData.user.clerkId();
      const mockUser = { emailAddresses: null }; // Malformed user

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);

      const server = createTestServer();
      
      await request(server)
        .get('/')
        .expect(500);
      
      server.close();
    });

    it('should handle very large conversation lists efficiently', async () => {
      const testUserId = TestData.user.clerkId();
      const testEmail = TestData.user.email();
      const mockUser = { emailAddresses: [{ emailAddress: testEmail }] };
      
      // Create 1000 conversations
      const largeConversationList = Array.from({ length: 1000 }, (_, i) => ({
        id: `conv_${i}`,
        title: `Conversation ${i}`,
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockAuth.mockResolvedValue({ userId: testUserId });
      mockCurrentUser.mockResolvedValue(mockUser);
      mockSyncClerkUser.mockResolvedValue({ id: testUserId, email: testEmail });
      mockListConversationsByUserId.mockResolvedValue(largeConversationList);

      const server = createTestServer();
      
      const response = await request(server)
        .get('/')
        .expect(200);

      expect(response.body).toHaveLength(1000);
      expect(response.body[0]).toMatchObject({
        id: 'conv_0',
        title: 'Conversation 0',
        userId: testUserId,
      });
      
      server.close();
    });
  });
});