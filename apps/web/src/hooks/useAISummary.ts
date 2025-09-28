import React from 'react';
import type { AISummaryRequest, AISummaryResponse } from '@enso/core';
import { fetchAISummary } from '../services/aiClient';
import type { AIClientMode } from '../services/aiClient';

export type UseAISummaryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAISummaryParams {
  id?: string;
  content?: string;
  enabled: boolean;
  mode: AIClientMode;
}

export const useAISummary = ({ id, content, enabled, mode }: UseAISummaryParams): {
  status: UseAISummaryStatus;
  data?: AISummaryResponse;
  error: Error | null;
  refresh: () => void;
} => {
  const cacheRef = React.useRef(new Map<string, AISummaryResponse>());
  const [state, setState] = React.useState<{
    status: UseAISummaryStatus;
    data?: AISummaryResponse;
    error: Error | null;
  }>({ status: 'idle', error: null });
  const [refreshToken, setRefreshToken] = React.useState(0);

  const cacheKey = id ?? (content ? content.slice(0, 128) : undefined);
  const trimmedContent = content?.trim() ?? '';

  React.useEffect(() => {
    if (!enabled || !trimmedContent || !cacheKey) {
      setState({ status: 'idle', data: undefined, error: null });
      return;
    }

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setState({ status: 'success', data: cached, error: null });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const payload: AISummaryRequest = {
      content: trimmedContent,
      mode
    };

    setState({ status: 'loading', data: undefined, error: null });

    fetchAISummary(payload, { signal: controller.signal })
      .then((response) => {
        if (cancelled) {
          return;
        }
        cacheRef.current.set(cacheKey, response);
        setState({ status: 'success', data: response, error: null });
      })
      .catch((error) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setState({
          status: 'error',
          data: undefined,
          error: error instanceof Error ? error : new Error(String(error))
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, trimmedContent, cacheKey, mode, refreshToken]);

  const refresh = React.useCallback(() => {
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    }
    setRefreshToken((value) => value + 1);
  }, [cacheKey]);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    refresh
  };
};

export default useAISummary;
