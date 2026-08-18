import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../httpClient.js';
import { ApiError } from '../types.js';

describe('Frontend HttpClient & Interceptors Suite', () => {
  let client: HttpClient;
  let mockAccessToken: string | null = 'test_access_token_123';
  let mockRefreshToken: string | null = 'test_refresh_token_456';
  const onTokensRefreshed = vi.fn();
  const onAuthFailure = vi.fn();

  beforeEach(() => {
    mockAccessToken = 'test_access_token_123';
    mockRefreshToken = 'test_refresh_token_456';
    vi.clearAllMocks();

    client = new HttpClient({
      baseUrl: 'https://api.bytebeacon.test/api/v1',
      getAccessToken: () => mockAccessToken,
      getRefreshToken: () => mockRefreshToken,
      onTokensRefreshed,
      onAuthFailure,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should attach Authorization Bearer header, request-id, and unwrap ApiResponse envelope', async () => {
    const mockData = { id: 'ord_1', network: 'MTN', amountPesewas: 1000 };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: mockData }),
    } as any);

    const result = await client.get('/orders/ord_1');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.bytebeacon.test/api/v1/orders/ord_1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test_access_token_123',
          'Content-Type': 'application/json',
          'x-request-id': expect.any(String),
          'x-correlation-id': expect.any(String),
        }),
      }),
    );
  });

  it('should attach idempotency-key header when specified in options', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { status: 'QUEUED' } }),
    } as any);

    await client.post('/orders', { network: 'MTN', phone: '0241234567' }, {
      idempotencyKey: 'idemp_key_custom_999',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.bytebeacon.test/api/v1/orders',
      expect.objectContaining({
        headers: expect.objectContaining({
          'idempotency-key': 'idemp_key_custom_999',
        }),
      }),
    );
  });

  it('should properly format query parameters into request URL', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: [] }),
    } as any);

    await client.get('/orders', {
      params: { page: 2, limit: 20, network: 'MTN', search: '024' },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.bytebeacon.test/api/v1/orders?page=2&limit=20&network=MTN&search=024',
      expect.anything(),
    );
  });

  it('should automatically refresh access token on 401 and replay the original request', async () => {
    // 1st call to /orders/1 -> 401 Unauthorized
    // 2nd call to /auth/refresh -> 200 OK with new tokens
    // 3rd call to /orders/1 (replayed) -> 200 OK with data
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ success: false, error: { message: 'Token expired' } }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'new_fresh_token_789',
              refreshToken: 'new_refresh_token_999',
              expiresInSeconds: 900,
            },
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { id: 'ord_replayed_success' } }),
      } as any);

    const result = await client.get('/orders/ord_1');

    expect(result).toEqual({ id: 'ord_replayed_success' });
    expect(onTokensRefreshed).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'new_fresh_token_789' }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should invoke onAuthFailure and throw ApiError when token refresh fails', async () => {
    // 1st call: 401
    // 2nd call (/auth/refresh): 401 or network failure
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ success: false, error: { message: 'Token expired' } }),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ success: false, error: { message: 'Invalid refresh token' } }),
      } as any);

    await expect(client.get('/orders/ord_1')).rejects.toThrow(ApiError);
    expect(onAuthFailure).toHaveBeenCalled();
  });

  it('should extract structured ApiError details on HTTP 400 Bad Request', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_PHONE_NUMBER',
            message: 'Phone number format is invalid',
            details: [{ field: 'phoneNumber', message: 'Must be 10 digits' }],
          },
        }),
    } as any);

    try {
      await client.post('/orders', { phoneNumber: 'invalid' });
      expect.unreachable('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('INVALID_PHONE_NUMBER');
      expect(err.message).toBe('Phone number format is invalid');
      expect(err.details).toEqual([{ field: 'phoneNumber', message: 'Must be 10 digits' }]);
    }
  });
});
