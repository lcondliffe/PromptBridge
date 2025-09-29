import { describe, it, expect } from 'vitest';
import { GET } from '../../src/app/api/health/route';

describe('Health API', () => {
  it('should return health status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('ok', true);
    expect(data).toHaveProperty('now');
    expect(typeof data.now).toBe('string');
  });

  it('should return valid ISO timestamp', async () => {
    const response = await GET();
    const data = await response.json();

    const timestamp = new Date(data.now);
    expect(timestamp.toISOString()).toBe(data.now);
  });
});
