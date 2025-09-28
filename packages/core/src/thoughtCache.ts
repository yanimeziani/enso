import type { Thought } from './thought';
import { normalizeThought } from './thought';

export type PendingChangeKind = 'upsert' | 'delete';

export interface PendingThoughtChange {
  kind: PendingChangeKind;
  thought: Thought;
}

const THOUGHT_CACHE_KEY = 'enso.cache.thoughts.v1';
const CURSOR_CACHE_KEY = 'enso.cache.cursor.v1';
const PENDING_CACHE_KEY = 'enso.cache.pending.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  } satisfies StorageLike;
})();

const resolveStorage = (): StorageLike => {
  try {
    const scoped = (globalThis as any).localStorage as Storage | undefined;
    if (scoped) {
      return scoped;
    }
  } catch (error) {
    // ignore access errors (e.g., private mode)
  }
  return memoryStorage;
};

const readJson = <T>(key: string, fallback: T): T => {
  const storage = resolveStorage();
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    storage.removeItem(key);
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  const storage = resolveStorage();
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // ignore write failures
  }
};

export const readCachedThoughts = (): Thought[] => {
  const payload = readJson<Thought[]>(THOUGHT_CACHE_KEY, []);
  return payload.map((thought) => normalizeThought(thought));
};

export const writeCachedThoughts = (thoughts: Thought[]): void => {
  writeJson(THOUGHT_CACHE_KEY, thoughts);
};

export const readCachedCursor = (): string | null => {
  const cursor = readJson<string | null>(CURSOR_CACHE_KEY, null);
  return cursor;
};

export const writeCachedCursor = (cursor: string | null): void => {
  if (!cursor) {
    resolveStorage().removeItem(CURSOR_CACHE_KEY);
    return;
  }
  writeJson(CURSOR_CACHE_KEY, cursor);
};

export const readPendingChanges = (): PendingThoughtChange[] => {
  const raw = readJson<PendingThoughtChange[]>(PENDING_CACHE_KEY, []);
  return raw.map((change) => ({
    kind: change.kind,
    thought: normalizeThought(change.thought)
  }));
};

export const overwritePendingChanges = (changes: PendingThoughtChange[]): void => {
  writeJson(PENDING_CACHE_KEY, changes.map((change) => ({
    kind: change.kind,
    thought: change.thought
  })));
};

export const appendPendingChange = (change: PendingThoughtChange): PendingThoughtChange[] => {
  const current = readPendingChanges();
  const next = [...current, change];
  overwritePendingChanges(next);
  return next;
};

export const clearPendingChanges = (): void => {
  resolveStorage().removeItem(PENDING_CACHE_KEY);
};
