import type { Thought } from './thought';
import { normalizeThought } from './thought';
import { resolveApiBaseUrl, resolveClientId } from './runtimeEnv';
import {
  appendPendingChange,
  clearPendingChanges,
  overwritePendingChanges,
  readPendingChanges,
  readCachedCursor,
  writeCachedCursor,
  type PendingThoughtChange
} from './thoughtCache';

interface ServerSyncThoughtPayload {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface ServerSyncResponse {
  cursor: string;
  changes: ServerSyncThoughtPayload[];
  has_more?: boolean;
}

const toServerPayload = (change: PendingThoughtChange): ServerSyncThoughtPayload => ({
  id: change.thought.id,
  title: change.thought.title,
  content: change.thought.content,
  tags: change.thought.tags,
  links: change.thought.links,
  created_at: change.thought.createdAt,
  updated_at: change.thought.updatedAt,
  deleted_at: change.kind === 'delete' ? change.thought.updatedAt : undefined
});

const toClientThought = (payload: ServerSyncThoughtPayload): Thought =>
  normalizeThought({
    id: payload.id,
    title: payload.title,
    content: payload.content,
    tags: payload.tags,
    links: payload.links,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at
  });

const fetchSync = async (body: object, baseUrl: string): Promise<ServerSyncResponse> => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/sync/thoughts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Sync failed: ${response.status}`);
  }

  const json = (await response.json()) as ServerSyncResponse;
  return json;
};

export interface ThoughtSyncOptions {
  baseUrl?: string;
  clientId?: string;
  since?: string | null;
}

export interface ThoughtSyncResult {
  cursor: string;
  changes: Thought[];
  hasMore: boolean;
}

export const syncThoughts = async ({
  baseUrl = resolveApiBaseUrl(),
  clientId,
  since
}: ThoughtSyncOptions = {}): Promise<ThoughtSyncResult> => {
  const pending = readPendingChanges();
  const cursor = since ?? readCachedCursor();
  const payload = {
    client_id: clientId ?? resolveClientId(),
    since: cursor ?? undefined,
    changes: pending.map(toServerPayload)
  };

  const result = await fetchSync(payload, baseUrl);

  const thoughts = result.changes.map(toClientThought);
  writeCachedCursor(result.cursor);

  clearPendingChanges();

  return {
    cursor: result.cursor,
    changes: thoughts,
    hasMore: Boolean(result.has_more)
  };
};

export const queuePendingUpsert = (thought: Thought): void => {
  appendPendingChange({
    kind: 'upsert',
    thought
  });
};

export const queuePendingDelete = (thought: Thought): void => {
  appendPendingChange({
    kind: 'delete',
    thought
  });
};

export const replacePendingChanges = (changes: PendingThoughtChange[]): void => {
  overwritePendingChanges(changes);
};

export const clearPending = (): void => {
  clearPendingChanges();
};
