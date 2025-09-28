import React from 'react';
import type { AISearchRequest, AISearchResponse } from '@enso/core';
import { fetchAISearch } from '../services/aiClient';
import type { AIClientMode } from '../services/aiClient';

export type UseAISearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAISearchOptions {
  enabled: boolean;
  mode: AIClientMode;
  minLength?: number;
  debounceMs?: number;
}

const DEFAULT_OPTIONS = {
  minLength: 3,
  debounceMs: 500
};

export const useAISearchResults = (query: string, options: UseAISearchOptions): {
  status: UseAISearchStatus;
  data?: AISearchResponse;
  results: AISearchResponse['results'];
  error: Error | null;
  refresh: () => void;
} => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = React.useState<{
    status: UseAISearchStatus;
    data?: AISearchResponse;
    error: Error | null;
  }>({ status: 'idle', error: null });
  const [nonce, setNonce] = React.useState(0);

  const normalizedQuery = React.useMemo(() => query.trim(), [query]);

  React.useEffect(() => {
    if (!settings.enabled) {
      setState({ status: 'idle', data: undefined, error: null });
      return;
    }

    if (normalizedQuery.length < settings.minLength) {
      setState({ status: 'idle', data: undefined, error: null });
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const execute = () => {
      setState({ status: 'loading', data: undefined, error: null });
      const payload: AISearchRequest = {
        query: normalizedQuery,
        mode: settings.mode,
        limit: 5
      };

      fetchAISearch(payload, { signal: abortController.signal })
        .then((response) => {
          if (cancelled) {
            return;
          }
          setState({ status: 'success', data: response, error: null });
        })
        .catch((error) => {
          if (cancelled || abortController.signal.aborted) {
            return;
          }
          setState({
            status: 'error',
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error))
          });
        });
    };

    let timer: number | undefined;
    const hasWindow = typeof window !== 'undefined';
    if (settings.debounceMs && settings.debounceMs > 0 && hasWindow) {
      timer = window.setTimeout(execute, settings.debounceMs);
    } else {
      execute();
    }

    return () => {
      cancelled = true;
      abortController.abort();
      if (timer && hasWindow) {
        window.clearTimeout(timer);
      }
    };
  }, [normalizedQuery, settings.enabled, settings.mode, settings.minLength, settings.debounceMs, nonce]);

  const refresh = React.useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  return {
    status: state.status,
    data: state.data,
    results: state.data?.results ?? [],
    error: state.error,
    refresh
  };
};

export default useAISearchResults;
