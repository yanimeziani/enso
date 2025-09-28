import React from 'react';
import type { AISuggestRequest, AISuggestResponse } from '@enso/core';
import { fetchAISuggestions } from '../services/aiClient';

export type UseAISuggestionsStatus = 'idle' | 'loading' | 'success' | 'error';

export type UseAISuggestionsOptions = {
  enabled?: boolean;
  debounceMs?: number;
  immediate?: boolean;
};

export type UseAISuggestionsValue = {
  status: UseAISuggestionsStatus;
  suggestions: AISuggestResponse['suggestions'];
  data?: AISuggestResponse;
  error: Error | null;
  refresh: () => void;
  isLoading: boolean;
};

const DEFAULT_OPTIONS: Required<Pick<UseAISuggestionsOptions, 'enabled' | 'debounceMs' | 'immediate'>> = {
  enabled: true,
  debounceMs: 450,
  immediate: false
};

export const useAISuggestions = (
  payload: AISuggestRequest | null,
  options: UseAISuggestionsOptions = {}
): UseAISuggestionsValue => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = React.useState<{
    status: UseAISuggestionsStatus;
    data?: AISuggestResponse;
    error: Error | null;
  }>({
    status: 'idle',
    error: null
  });

  const payloadSignature = React.useMemo(() => (payload ? JSON.stringify(payload) : null), [payload]);
  const [nonce, setNonce] = React.useState(0);
  const refresh = React.useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  React.useEffect(() => {
    if (!settings.enabled || !payload || !payload.content.trim()) {
      setState((current) =>
        current.status === 'idle'
          ? current
          : {
              status: 'idle',
              data: undefined,
              error: null
            }
      );
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const execute = () => {
      setState((current) => ({
        status: 'loading',
        data: settings.immediate ? current.data : undefined,
        error: null
      }));

      fetchAISuggestions(payload, { signal: abortController.signal })
        .then((result) => {
          if (cancelled) {
            return;
          }
          setState({ status: 'success', data: result, error: null });
        })
        .catch((error) => {
          if (cancelled || abortController.signal.aborted) {
            return;
          }
          setState({ status: 'error', data: undefined, error: error instanceof Error ? error : new Error(String(error)) });
        });
    };

    let timer: number | undefined;
    const hasWindow = typeof window !== 'undefined';
    if (settings.debounceMs > 0 && hasWindow) {
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
  }, [payload, payloadSignature, settings.enabled, settings.debounceMs, settings.immediate, nonce]);

  return {
    status: state.status,
    data: state.data,
    suggestions: state.data?.suggestions ?? [],
    error: state.error,
    refresh,
    isLoading: state.status === 'loading'
  };
};

export default useAISuggestions;
