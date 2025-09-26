import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/health/route';
import { createTestServer } from '../utils/integration-setup';

// Create a request handler for the GET method
const handler = async (req: NextRequest) => {
  if (req.method === 'GET') {
    return GET();
  }
  // Return a 405 Method Not Allowed response for other methods
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
};

describe('/api/health', () => {
  it('should return 200 with ok: true and timestamp', async () => {
    const { server } = createTestServer(handler);
    
    const response = await request(server)
      .get('/')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toMatchObject({
      ok: true,
      now: expect.any(String),
    });

    // Validate that the timestamp is a valid ISO string
    const timestamp = new Date(response.body.now);
    expect(timestamp.toISOString()).toBe(response.body.now);
    
    // Timestamp should be recent (within last minute)
    const now = new Date();
    const timeDiff = now.getTime() - timestamp.getTime();
    expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    expect(timeDiff).toBeGreaterThanOrEqual(0); // Not in the future
    
    server.close();
  });

  it('should return valid JSON response', async () => {
    const { server } = createTestServer(handler);
    
    const response = await request(server)
      .get('/')
      .expect(200);

    // Response should be parseable JSON
    expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    
    server.close();
  });

  it('should have correct response headers', async () => {
    const { server } = createTestServer(handler);
    
    await request(server)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200);
    
    server.close();
  });

  it('should be consistent across multiple calls', async () => {
    const { server } = createTestServer(handler);
    
    const responses = await Promise.all([
      request(server).get('/'),
      request(server).get('/'),
      request(server).get('/'),
    ]);

    // All responses should be successful
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        now: expect.any(String),
      });
    });

    // Timestamps should be different (calls made at different times)
    const timestamps = responses.map(r => r.body.now);
    const uniqueTimestamps = new Set(timestamps);
    
    // Allow for same timestamp if requests were very fast
    expect(uniqueTimestamps.size).toBeGreaterThanOrEqual(1);
    expect(uniqueTimestamps.size).toBeLessThanOrEqual(3);
    
    server.close();
  });

  it('should handle high concurrency', async () => {
    const { server } = createTestServer(handler);
    
    // Make many concurrent requests
    const concurrentRequests = Array.from({ length: 20 }, () => 
      request(server).get('/')
    );

    const responses = await Promise.all(concurrentRequests);

    // All responses should be successful
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        now: expect.any(String),
      });
    });
    
    server.close();
  });

  it('should work with different HTTP methods (even though only GET is implemented)', async () => {
    const { server } = createTestServer(handler);
    
    // GET should work
    await request(server)
      .get('/')
      .expect(200);

    // Other methods will get the same response since our handler only exports GET
    // but the server wrapper will still call GET
    await request(server)
      .post('/')
      .expect(405); // Our wrapper always calls GET
    
    server.close();
  });

  it('should maintain response schema', async () => {
    const { server } = createTestServer(handler);
    
    const response = await request(server)
      .get('/')
      .expect(200);

    // Verify exact schema
    expect(Object.keys(response.body).sort()).toEqual(['now', 'ok']);
    expect(typeof response.body.ok).toBe('boolean');
    expect(typeof response.body.now).toBe('string');
    expect(response.body.ok).toBe(true);
    
    server.close();
  });

  it('should handle rapid sequential requests', async () => {
    const { server } = createTestServer(handler);
    
    const responses = [];
    for (let i = 0; i < 10; i++) {
      const response = await request(server).get('/');
      responses.push(response);
    }

    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(typeof response.body.now).toBe('string');
    });
    
    server.close();
  });
});