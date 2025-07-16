import { z } from 'zod';
import type { ErrorRecovery } from '../agent/ErrorRecovery.js';

/**
 * Base API client with common functionality
 */
export abstract class ApiClient {
  protected baseUrl: string;
  protected apiKey?: string;
  protected headers: Record<string, string> = {};
  protected errorRecovery?: ErrorRecovery;
  protected timeout: number = 30000; // 30 seconds default
  
  constructor(config: {
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    errorRecovery?: ErrorRecovery;
    timeout?: number;
  }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };
    this.errorRecovery = config.errorRecovery;
    this.timeout = config.timeout || 30000;
    
    if (this.apiKey) {
      this.setAuthHeader(this.apiKey);
    }
  }

  /**
   * Sets the authorization header
   */
  protected abstract setAuthHeader(apiKey: string): void;

  /**
   * Makes an HTTP request with error handling and retries
   */
  protected async request<T>(config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    data?: any;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    schema?: z.ZodSchema<T>;
  }): Promise<T> {
    const url = this.buildUrl(config.path, config.params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    const requestConfig: RequestInit = {
      method: config.method,
      headers: {
        ...this.headers,
        ...config.headers
      },
      signal: controller.signal
    };
    
    if (config.data && config.method !== 'GET') {
      requestConfig.body = JSON.stringify(config.data);
    }
    
    try {
      const executeRequest = async () => {
        const response = await fetch(url, requestConfig);
        
        if (!response.ok) {
          throw new ApiError(
            `API request failed: ${response.status} ${response.statusText}`,
            response.status,
            await response.text()
          );
        }
        
        const data = await response.json();
        
        // Validate response if schema provided
        if (config.schema) {
          return config.schema.parse(data);
        }
        
        return data as T;
      };
      
      // Use error recovery if available
      if (this.errorRecovery) {
        return await this.errorRecovery.executeWithCircuitBreaker(
          executeRequest,
          'api_request',
          `${config.method} ${config.path}`
        );
      }
      
      return await executeRequest();
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408, 'Request exceeded timeout limit');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Builds the full URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(path, this.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  /**
   * GET request helper
   */
  protected async get<T>(
    path: string,
    params?: Record<string, any>,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request({ method: 'GET', path, params, schema });
  }

  /**
   * POST request helper
   */
  protected async post<T>(
    path: string,
    data?: any,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request({ method: 'POST', path, data, schema });
  }

  /**
   * PUT request helper
   */
  protected async put<T>(
    path: string,
    data?: any,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request({ method: 'PUT', path, data, schema });
  }

  /**
   * DELETE request helper
   */
  protected async delete<T>(
    path: string,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request({ method: 'DELETE', path, schema });
  }

  /**
   * PATCH request helper
   */
  protected async patch<T>(
    path: string,
    data?: any,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request({ method: 'PATCH', path, data, schema });
  }
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  public status: number;
  public responseBody: string;
  
  constructor(message: string, status: number, responseBody: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}