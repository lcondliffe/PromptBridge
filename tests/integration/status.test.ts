import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../../src/app/api/status/route';
import { countUsers } from '@promptbridge/api';

vi.mock('@promptbridge/api', () => ({
  countUsers: vi.fn(),
}));

const mockCountUsers = vi.mocked(countUsers);

describe('Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hasUsers: true when users exist', async () => {
    mockCountUsers.mockResolvedValue(5);
    
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ hasUsers: true });
    expect(mockCountUsers).toHaveBeenCalledOnce();
  });

  it('should return hasUsers: false when no users exist', async () => {
    mockCountUsers.mockResolvedValue(0);
    
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ hasUsers: false });
  });

  it('should handle database errors', async () => {
    mockCountUsers.mockRejectedValue(new Error('Database error'));
    
    await expect(GET()).rejects.toThrow('Database error');
  });
});
