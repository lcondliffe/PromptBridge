import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';

// Mock the countUsers function from the API package (must be at top level)
vi.mock('@promptbridge/api', () => ({
  countUsers: vi.fn(),
}));

import { GET } from '../../src/app/api/status/route';
import { countUsers } from '@promptbridge/api';

// Get reference to the mocked function
const mockCountUsers = vi.mocked(countUsers);

// Create a test server that wraps our Next.js route handler
function createTestServer() {
  return createServer(async (req, res) => {
    try {
      const response = await GET();
      const body = await response.json();
      
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
}

describe('/api/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hasUsers: true when users exist', async () => {
    mockCountUsers.mockResolvedValue(5); // 5 users exist
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      hasUsers: true,
    });
    
    expect(mockCountUsers).toHaveBeenCalledOnce();
    
    server.close();
  });

  it('should return hasUsers: false when no users exist', async () => {
    mockCountUsers.mockResolvedValue(0); // No users
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      hasUsers: false,
    });
    
    expect(mockCountUsers).toHaveBeenCalledOnce();
    
    server.close();
  });

  it('should return hasUsers: true for count of 1', async () => {
    mockCountUsers.mockResolvedValue(1); // Exactly 1 user
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    expect(response.body).toEqual({
      hasUsers: true,
    });
    
    server.close();
  });

  it('should handle large user counts', async () => {
    mockCountUsers.mockResolvedValue(999999); // Very large count
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    expect(response.body).toEqual({
      hasUsers: true,
    });
    
    server.close();
  });

  it('should handle database errors gracefully', async () => {
    const dbError = new Error('Database connection failed');
    mockCountUsers.mockRejectedValue(dbError);
    
    const server = createTestServer();
    
    // The error should bubble up and cause a 500 response
    await request(server)
      .get('/')
      .expect(500);
    
    expect(mockCountUsers).toHaveBeenCalledOnce();
    
    server.close();
  });

  it('should handle countUsers returning null/undefined', async () => {
    mockCountUsers.mockResolvedValue(null);
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    // null/undefined should be falsy, so hasUsers should be false
    expect(response.body).toEqual({
      hasUsers: false,
    });
    
    server.close();
  });

  it('should handle countUsers returning NaN', async () => {
    mockCountUsers.mockResolvedValue(NaN);
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    // NaN > 0 is false, so hasUsers should be false
    expect(response.body).toEqual({
      hasUsers: false,
    });
    
    server.close();
  });

  it('should handle negative user counts', async () => {
    mockCountUsers.mockResolvedValue(-5); // Negative count (shouldn't happen in reality)
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    // -5 > 0 is false, so hasUsers should be false
    expect(response.body).toEqual({
      hasUsers: false,
    });
    
    server.close();
  });

  it('should maintain consistent response schema', async () => {
    mockCountUsers.mockResolvedValue(42);
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    // Verify exact schema
    expect(Object.keys(response.body)).toEqual(['hasUsers']);
    expect(typeof response.body.hasUsers).toBe('boolean');
    
    server.close();
  });

  it('should handle concurrent requests correctly', async () => {
    mockCountUsers.mockResolvedValue(10);
    
    const server = createTestServer();
    
    // Make multiple concurrent requests
    const requests = Array.from({ length: 5 }, () => request(server).get('/'));
    const responses = await Promise.all(requests);
    
    // All should succeed with consistent results
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ hasUsers: true });
    });
    
    // Should have called countUsers for each request
    expect(mockCountUsers).toHaveBeenCalledTimes(5);
    
    server.close();
  });

  it('should call countUsers exactly once per request', async () => {
    mockCountUsers.mockResolvedValue(3);
    
    const server = createTestServer();
    
    await request(server).get('/').expect(200);
    
    expect(mockCountUsers).toHaveBeenCalledTimes(1);
    expect(mockCountUsers).toHaveBeenCalledWith(); // Called with no arguments
    
    server.close();
  });

  it('should handle very slow database responses', async () => {
    // Simulate slow database
    mockCountUsers.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(2), 100))
    );
    
    const server = createTestServer();
    
    const startTime = Date.now();
    const response = await request(server)
      .get('/')
      .expect(200);
    const endTime = Date.now();
    
    expect(response.body).toEqual({ hasUsers: true });
    expect(endTime - startTime).toBeGreaterThanOrEqual(100); // At least 100ms
    
    server.close();
  });

  it('should handle different numeric edge cases', async () => {
    const testCases = [
      { count: 0, expected: false },
      { count: 0.5, expected: true },  // 0.5 > 0 is true
      { count: 1, expected: true },
      { count: 1.1, expected: true },
      { count: Infinity, expected: true },
      { count: -Infinity, expected: false },
    ];
    
    for (const { count, expected } of testCases) {
      mockCountUsers.mockResolvedValue(count);
      
      const server = createTestServer();
      
      const response = await request(server)
        .get('/')
        .expect(200);
      
      expect(response.body).toEqual({ hasUsers: expected });
      
      server.close();
    }
  });

  it('should handle string-like numbers', async () => {
    // This tests if the database somehow returns a string
    mockCountUsers.mockResolvedValue('5' as unknown);
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    // '5' > 0 is true in JavaScript
    expect(response.body).toEqual({ hasUsers: true });
    
    server.close();
  });

  it('should be accessible without authentication', async () => {
    // This endpoint should be public, so test without any auth headers
    mockCountUsers.mockResolvedValue(1);
    
    const server = createTestServer();
    
    const response = await request(server)
      .get('/')
      .expect(200);

    expect(response.body).toEqual({ hasUsers: true });
    
    server.close();
  });
});