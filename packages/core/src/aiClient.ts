import { resolveAiBaseUrl } from './runtimeEnv';

export type AISuggestionType = 'tag' | 'project' | 'focus' | 'summary' | 'link' | 'note';
export type AIClientMode = 'auto' | 'local' | 'remote' | 'stub';

export type AISuggestion = {
  /** Unique identifier if provided by the model. */
  id?: string;
  type: AISuggestionType;
  /** Primary label to surface in the UI (e.g., "#focus"). */
  label: string;
  /** Optional rich value to apply when selected (can mirror label). */
  value?: string;
  confidence?: number;
  metadata?: Record<string, string>;
};

export type AISuggestRequest = {
  content: string;
  cursor?: number;
  tags?: string[];
  mode?: AIClientMode;
  context?: Record<string, unknown>;
};

export type AISuggestResponse = {
  suggestions: AISuggestion[];
  latencyMs?: number;
  source?: 'local' | 'remote' | 'stub';
};

export type AISearchRequest = {
  query: string;
  limit?: number;
  mode?: AIClientMode;
  filters?: Record<string, string | undefined>;
};

export type AISearchResult = {
  id?: string;
  title: string;
  snippet: string;
  score?: number;
  metadata?: Record<string, string>;
};

export type AISearchResponse = {
  results: AISearchResult[];
  latencyMs?: number;
  source?: 'local' | 'remote' | 'stub';
};

export type AISummaryRequest = {
  content: string;
  mode?: AIClientMode;
  focus?: string;
  length?: 'brief' | 'detailed';
};

export type AISummaryResponse = {
  summary: string;
  highlights?: string[];
  source?: 'local' | 'remote' | 'stub';
  latencyMs?: number;
};

export type AIHealthResponse = {
  status: 'ok' | 'unavailable';
  detail?: string;
  mode?: string;
  enabled?: boolean;
};

export type AIClientRequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export interface AIClient {
  suggest(payload: AISuggestRequest, options?: AIClientRequestOptions): Promise<AISuggestResponse>;
  search(payload: AISearchRequest, options?: AIClientRequestOptions): Promise<AISearchResponse>;
  summarize(payload: AISummaryRequest, options?: AIClientRequestOptions): Promise<AISummaryResponse>;
  health(options?: AIClientRequestOptions): Promise<AIHealthResponse>;
}

export class AIClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'AIClientError';
  }
}

const withJson = (init?: RequestInit): RequestInit => ({
  headers: {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {})
  },
  ...init
});

export class HttpAIClient implements AIClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = resolveAiBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    options?: AIClientRequestOptions
  ): Promise<T> {
    const requestInit: RequestInit = {
      ...withJson(init),
      signal: options?.signal,
      headers: {
        ...(init.headers ?? {}),
        ...(options?.headers ?? {})
      }
    };
    const response = await fetch(`${this.baseUrl}${path}`, requestInit);
    if (!response.ok) {
      const detail = await response.text();
      throw new AIClientError(detail || `AI request failed: ${response.status}`, response.status);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  async suggest(payload: AISuggestRequest, options?: AIClientRequestOptions): Promise<AISuggestResponse> {
    return this.request<AISuggestResponse>(
      '/api/ai/suggest',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      options
    );
  }

  async search(payload: AISearchRequest, options?: AIClientRequestOptions): Promise<AISearchResponse> {
    return this.request<AISearchResponse>(
      '/api/ai/search',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      options
    );
  }

  async summarize(payload: AISummaryRequest, options?: AIClientRequestOptions): Promise<AISummaryResponse> {
    return this.request<AISummaryResponse>(
      '/api/ai/summary',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      options
    );
  }

  async health(options?: AIClientRequestOptions): Promise<AIHealthResponse> {
    return this.request<AIHealthResponse>(
      '/api/ai/health',
      {
        method: 'GET'
      },
      options
    );
  }
}

export default HttpAIClient;
