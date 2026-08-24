import { ApiClientConfig, RequestOptions, ApiError, AuthTokens } from './types.js';
import { ApiResponse } from '@bytebeacon/shared';

export class HttpClient {
  private config: ApiClientConfig;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor(config?: Partial<ApiClientConfig>) {
    this.config = {
      baseUrl: (() => {
        const envUrl =
          import.meta.env.VITE_API_BASE_URL ||
          import.meta.env.VITE_API_URL ||
          import.meta.env.VITE_BACKEND_URL ||
          import.meta.env.VITE_SERVER_URL;
        if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
          const trimmed = envUrl.trim().replace(/\/+$/, '');
          return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
        }
        if (import.meta.env.DEV) {
          return '/api/v1';
        }
        return 'https://bytebeacon-2-0.onrender.com/api/v1';
      })(),
      getAccessToken: () => {
        try {
          const stored = localStorage.getItem('bytebeacon_auth_tokens');
          if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.accessToken || null;
          }
        } catch {
          // Ignore
        }
        return null;
      },
      getRefreshToken: () => {
        try {
          const stored = localStorage.getItem('bytebeacon_auth_tokens');
          if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.refreshToken || null;
          }
        } catch {
          // Ignore
        }
        return null;
      },
      onTokensRefreshed: (tokens) => {
        try {
          localStorage.setItem('bytebeacon_auth_tokens', JSON.stringify(tokens));
        } catch {
          // Ignore
        }
      },
      onAuthFailure: () => {
        try {
          localStorage.removeItem('bytebeacon_auth_user');
          localStorage.removeItem('bytebeacon_auth_tokens');
        } catch {
          // Ignore
        }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth/login';
        }
      },
      ...config,
    };
  }

  public setConfig(newConfig: Partial<ApiClientConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  private generateRequestId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const base = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;

    let fullUrl = `${base}${cleanEndpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        fullUrl += `${fullUrl.includes('?') ? '&' : '?'}${qs}`;
      }
    }

    return fullUrl;
  }

  private onTokenRefreshed(token: string | null) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(cb: (token: string | null) => void) {
    this.refreshSubscribers.push(cb);
  }

  private async executeTokenRefresh(): Promise<string | null> {
    const refreshToken = this.config.getRefreshToken();
    if (!refreshToken) {
      this.config.onAuthFailure();
      return null;
    }

    try {
      const refreshUrl = this.buildUrl('/auth/refresh');
      const res = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': this.generateRequestId(),
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        throw new Error('Refresh token invalid or expired');
      }

      const text = await res.text();
      const json: ApiResponse<AuthTokens> = text ? JSON.parse(text) : {};
      if (json.success && json.data) {
        this.config.onTokensRefreshed(json.data);
        return json.data.accessToken;
      }
      throw new Error('Invalid refresh response payload');
    } catch {
      this.config.onAuthFailure();
      return null;
    }
  }

  public async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      idempotencyKey,
      skipAuth = false,
      timeoutMs = 30000,
      params,
      headers: customHeaders = {},
      ...fetchOptions
    } = options;

    const url = this.buildUrl(endpoint, params);
    const requestId = this.generateRequestId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      'x-correlation-id': requestId,
      ...(customHeaders as Record<string, string>),
    };

    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    if (!skipAuth) {
      const token = this.config.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle 401 Unauthorized with Automatic Token Refresh & Request Replay
      if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          const newToken = await this.executeTokenRefresh();
          this.isRefreshing = false;
          this.onTokenRefreshed(newToken);

          if (newToken) {
            return this.request<T>(endpoint, options);
          }
          throw new ApiError('Session expired. Please log in again.', 401, 'UNAUTHORIZED', undefined, requestId);
        }

        // Another request is currently refreshing the token; wait for it
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber((newToken) => {
            if (newToken) {
              resolve(this.request<T>(endpoint, options));
            } else {
              reject(new ApiError('Session expired. Please log in again.', 401, 'UNAUTHORIZED', undefined, requestId));
            }
          });
        });
      }

      if (!response.ok) {
        let responseBody: any;
        try {
          const text = await response.text();
          responseBody = text ? JSON.parse(text) : {};
        } catch {
          responseBody = {};
        }
        const errorMessage = responseBody?.error?.message || responseBody?.message || `HTTP error ${response.status}`;
        const errorCode = responseBody?.error?.code || responseBody?.code || 'API_ERROR';
        const details = responseBody?.error?.details || responseBody?.details;

        if (
          typeof window !== 'undefined' &&
          (response.status === 503 || errorCode === 'MAINTENANCE_MODE_ACTIVE')
        ) {
          window.dispatchEvent(
            new CustomEvent('platform-maintenance-active', {
              detail: { message: errorMessage },
            }),
          );
        }

        throw new ApiError(errorMessage, response.status, errorCode, details, requestId);
      }

      if (options.responseType === 'blob') {
        return (await response.blob()) as unknown as T;
      }
      if (options.responseType === 'text') {
        return (await response.text()) as unknown as T;
      }

      // Parse JSON response
      let responseBody: any;
      const text = await response.text();
      try {
        responseBody = text ? JSON.parse(text) : {};
      } catch {
        responseBody = { rawText: text };
      }

      // If backend returned standardized ApiResponse envelope, extract data
      if (responseBody && typeof responseBody === 'object' && 'success' in responseBody) {
        if (!responseBody.success) {
          throw new ApiError(
            responseBody.error?.message || 'Request was not successful',
            response.status,
            responseBody.error?.code || 'API_ERROR',
            responseBody.error?.details,
            requestId,
          );
        }
        return responseBody.data !== undefined ? responseBody.data : responseBody;
      }

      return responseBody as T;
    } catch (err: any) {
      clearTimeout(timer);
      if (err instanceof ApiError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out. Please try again.', 408, 'REQUEST_TIMEOUT', undefined, requestId);
      }
      throw new ApiError(err.message || 'Network error occurred', 0, 'NETWORK_ERROR', undefined, requestId);
    }
  }

  public get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = any>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  }

  public put<T = any>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  }

  public patch<T = any>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  }

  public delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new HttpClient();
