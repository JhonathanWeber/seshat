/**
 * API Client
 *
 * HTTP client para comunicação com a Tools API.
 * Implementa retry, timeout e error handling.
 */

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(config?: Partial<ApiClientConfig>) {
    this.baseUrl =
      config?.baseUrl || process.env.SESHAT_API_URL || "http://127.0.0.1:3344";
    this.apiKey = config?.apiKey || process.env.SESHAT_API_KEY || "";
    this.timeoutMs = config?.timeoutMs || 30000;
    this.maxRetries = config?.maxRetries || 2;
    console.error(`[ApiClient] BaseURL: ${this.baseUrl}`);
  }

  /**
   * POST request to Tools API
   */
  async post(endpoint: string, body: unknown): Promise<unknown> {
    return this.request("POST", endpoint, body);
  }

  /**
   * GET request to Tools API
   */
  async get(endpoint: string): Promise<unknown> {
    return this.request("GET", endpoint);
  }

  /**
   * Generic HTTP request to Tools API
   */
  private async request(
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown,
  ): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (this.apiKey) {
          headers["X-API-Key"] = this.apiKey;
        }

        console.error(`[ApiClient] Fetching: ${this.baseUrl}${endpoint}`);
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API error ${response.status}: ${errorBody}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (lastError.message.includes("API error 4")) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 500),
          );
        }
      }
    }

    throw lastError || new Error("Unknown API error");
  }

  /**
   * Health check da Tools API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
