/** Utility helpers to resolve runtime configuration shared across platforms. */

const DEFAULT_API_URL = 'http://127.0.0.1:8000';
const DEFAULT_AI_URL = DEFAULT_API_URL;

const readGlobal = <T>(resolver: (scope: any) => T | undefined): T | undefined => {
  try {
    return resolver(globalThis as any);
  } catch (error) {
    return undefined;
  }
};

export const resolveApiBaseUrl = (): string => {
  const fromWindow = readGlobal((scope) => scope.__ENSO_API_URL__ as string | undefined);
  if (fromWindow) {
    return fromWindow;
  }

  const fromProcess = readGlobal((scope) => scope.process?.env?.ENSO_API_URL as string | undefined);
  if (fromProcess) {
    return fromProcess;
  }

  // Support Vite/ESM style globals when available.
  try {
    const viteUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_ENSO_API_URL : undefined;
    if (typeof viteUrl === 'string' && viteUrl) {
      return viteUrl;
    }
  } catch (error) {
    // noop – environments without import.meta
  }

  const fallback = readGlobal((scope) => scope.process?.env?.VITE_ENSO_API_URL as string | undefined);
  if (fallback) {
    return fallback;
  }

  return DEFAULT_API_URL;
};

export const resolveAiBaseUrl = (): string => {
  const fromWindow = readGlobal((scope) => scope.__ENSO_AI_URL__ as string | undefined);
  if (fromWindow) {
    return fromWindow;
  }

  const fromProcess = readGlobal((scope) => scope.process?.env?.ENSO_AI_URL as string | undefined);
  if (fromProcess) {
    return fromProcess;
  }

  try {
    const viteUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_ENSO_AI_URL : undefined;
    if (typeof viteUrl === 'string' && viteUrl) {
      return viteUrl;
    }
  } catch (error) {
    // noop – environments without import.meta
  }

  const fallback = readGlobal((scope) => scope.process?.env?.VITE_ENSO_AI_URL as string | undefined);
  if (fallback) {
    return fallback;
  }

  return DEFAULT_AI_URL;
};

export const resolveClientId = (storage?: Storage): string => {
  const STORAGE_KEY = 'enso.sync.client_id';
  const targetStorage = storage ?? readGlobal((scope) => scope.localStorage as Storage | undefined);
  if (!targetStorage) {
    return 'enso-client';
  }

  const cached = targetStorage.getItem(STORAGE_KEY);
  if (cached) {
    return cached;
  }

  const id = `enso-${Math.random().toString(36).slice(2, 10)}`;
  try {
    targetStorage.setItem(STORAGE_KEY, id);
  } catch (error) {
    // ignore storage errors (quota, private mode, etc.)
  }
  return id;
};
