import { environment } from './environment';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  retries?: number;
  timeout?: number;
};

class ApiService {
  private getUrl(url: string): string {
    const baseUrl = environment.apiUrl.replace(/\/+$/, '');
    const endpoint = url.replace(/^\/+/, '');
    return `${baseUrl}/${endpoint}`;
  }

  private getErrorMessage(body: unknown, fallback: string): string {
    if (body && typeof body === 'object') {
      const errorBody = body as {
        error?: unknown;
        detail?: unknown;
        message?: unknown;
      };
      if (typeof errorBody.error === 'string') return errorBody.error;
      if (typeof errorBody.detail === 'string') return errorBody.detail;
      if (typeof errorBody.message === 'string') return errorBody.message;
    }
    return fallback;
  }

  private async wait(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    const {
      retries,
      timeout = environment.apiTimeout,
      headers: providedHeaders,
      ...requestOptions
    } = options;
    const method = (requestOptions.method || 'GET').toUpperCase();
    const retryCount =
      retries ?? (method === 'GET' || method === 'HEAD' ? environment.maxRetries : 0);
    const requestUrl = this.getUrl(url);
    const headers = new Headers(providedHeaders);

    if (
      requestOptions.body !== undefined &&
      typeof requestOptions.body === 'string' &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(requestUrl, {
          ...requestOptions,
          headers,
          signal: controller.signal
        });

        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            body = undefined;
          }
          throw new ApiError(
            this.getErrorMessage(body, response.statusText || 'The request failed.'),
            response.status
          );
        }

        if (response.status === 204) {
          return undefined as T;
        }

        try {
          return await response.json() as T;
        } catch {
          throw new Error('The server returned an invalid response.');
        }
      } catch (error) {
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';
        const isRetryable = error instanceof TypeError || isTimeout;

        if (!isRetryable) {
          console.error(`API request failed: ${method} ${requestUrl}`, error);
          throw error;
        }

        if (attempt === retryCount) {
          console.error(`API request failed: ${method} ${requestUrl}`, error);
          if (isTimeout) {
            throw new Error('The request timed out. Please try again.');
          }
          throw new Error('Unable to connect to the server. Please try again.');
        }

        await this.wait(environment.retryDelay * (attempt + 1));
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw new Error('The API request did not complete.');
  }

  async get<T = unknown>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T = unknown>(url: string, data: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async postFormData<T = unknown>(url: string, formData: FormData): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: formData
    });
  }

  async putFormData<T = unknown>(url: string, formData: FormData): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: formData
    });
  }

  async put<T = unknown>(url: string, data: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async patch<T = unknown>(url: string, data: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete<T = unknown>(url: string): Promise<T> {
    return this.request<T>(url, {
      method: 'DELETE'
    });
  }
}

export const apiService = new ApiService();
export const apiRequest = apiService.request.bind(apiService);
export default apiService;
