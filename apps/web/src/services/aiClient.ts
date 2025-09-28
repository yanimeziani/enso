import {
  HttpAIClient,
  type AIClient,
  type AIClientRequestOptions,
  type AIHealthResponse,
  type AISearchRequest,
  type AISearchResponse,
  type AISuggestRequest,
  type AISuggestResponse,
  type AISummaryRequest,
  type AISummaryResponse
} from '@enso/core';

export type AIClientMode = 'auto' | 'local' | 'remote' | 'stub';

export type AIClientConfig = {
  enabled: boolean;
  baseUrl?: string;
  mode?: AIClientMode;
  headers?: Record<string, string>;
};

const defaultConfig: AIClientConfig = {
  enabled: true,
  mode: 'auto'
};

let activeClient: AIClient | null = null;
let activeConfig: AIClientConfig = { ...defaultConfig };

const buildClient = (): AIClient => {
  if (activeClient) {
    return activeClient;
  }
  const client = new HttpAIClient(activeConfig.baseUrl);
  activeClient = client;
  return client;
};

const withConfig = <T>(
  handler: (client: AIClient, requestInit?: AIClientRequestOptions) => Promise<T>,
  requestInit?: AIClientRequestOptions
): Promise<T> => {
  const client = buildClient();
  const mergedInit: AIClientRequestOptions | undefined = activeConfig.headers
    ? {
        ...requestInit,
        headers: {
          ...(activeConfig.headers ?? {}),
          ...(requestInit?.headers ?? {})
        }
      }
    : requestInit;
  return handler(client, mergedInit);
};

export const configureAIClient = (config: Partial<AIClientConfig>): void => {
  activeConfig = {
    ...defaultConfig,
    ...activeConfig,
    ...config
  };
  activeClient = null;
};

export const resetAIClient = (): void => {
  activeClient = null;
  activeConfig = { ...defaultConfig };
};

export const fetchAISuggestions = (
  payload: AISuggestRequest,
  options?: AIClientRequestOptions
): Promise<AISuggestResponse> => {
  if (!activeConfig.enabled) {
    return Promise.resolve({ suggestions: [], source: 'stub' });
  }
  const body: AISuggestRequest = {
    ...payload,
    mode: payload.mode ?? activeConfig.mode
  };
  return withConfig((client, init) => client.suggest(body, init), options);
};

export const fetchAISearch = (
  payload: AISearchRequest,
  options?: AIClientRequestOptions
): Promise<AISearchResponse> => {
  if (!activeConfig.enabled) {
    return Promise.resolve({ results: [], source: 'stub' });
  }
  const body: AISearchRequest = {
    ...payload,
    mode: payload.mode ?? activeConfig.mode
  };
  return withConfig((client, init) => client.search(body, init), options);
};

export const fetchAISummary = (
  payload: AISummaryRequest,
  options?: AIClientRequestOptions
): Promise<AISummaryResponse> => {
  if (!activeConfig.enabled) {
    return Promise.resolve({ summary: '', source: 'stub' });
  }
  const body: AISummaryRequest = {
    ...payload,
    mode: payload.mode ?? activeConfig.mode
  };
  return withConfig((client, init) => client.summarize(body, init), options);
};

export const fetchAIHealth = (options?: AIClientRequestOptions): Promise<AIHealthResponse> => {
  if (!activeConfig.enabled) {
    return Promise.resolve({ status: 'ok', mode: activeConfig.mode ?? 'auto' });
  }
  return withConfig((client, init) => client.health(init), options);
};

export const getAIClientConfig = (): AIClientConfig => ({ ...activeConfig });

export default {
  configure: configureAIClient,
  reset: resetAIClient,
  suggest: fetchAISuggestions,
  search: fetchAISearch,
  summarize: fetchAISummary,
  health: fetchAIHealth,
  config: getAIClientConfig
};
