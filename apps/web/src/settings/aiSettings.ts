import { type AIClientMode } from '../services/aiClient';

export type AISettings = {
  enabled: boolean;
  mode: AIClientMode;
};

const STORAGE_KEY = 'enso.ai.settings.v1';

export const defaultAISettings: AISettings = {
  enabled: true,
  mode: 'auto'
};

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const readAISettings = (): AISettings => {
  if (!isBrowser()) {
    return defaultAISettings;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultAISettings;
    }
    const parsed = JSON.parse(stored) as Partial<AISettings> | null;
    if (!parsed) {
      return defaultAISettings;
    }
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultAISettings.enabled,
      mode: (parsed.mode as AIClientMode) ?? defaultAISettings.mode
    };
  } catch (error) {
    console.warn('Unable to read AI settings, falling back to defaults', error);
    return defaultAISettings;
  }
};

export const writeAISettings = (settings: AISettings): void => {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Unable to persist AI settings', error);
  }
};

export const resetAISettings = (): void => {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to reset AI settings', error);
  }
};

export const availableAIModes: AIClientMode[] = ['auto', 'local', 'remote', 'stub'];
