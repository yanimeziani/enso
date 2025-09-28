export type { Thought, ThoughtDraft, ThoughtId, ThoughtUpdate } from './thought';
export { normalizeThought, applyThoughtUpdate, isTagIncluded, matchesQuery } from './thought';
export type { ThoughtRepository } from './thoughtRepository';
export { InMemoryThoughtRepository } from './thoughtRepository';
export { HttpThoughtRepository } from './httpThoughtRepository';
export {
  HttpAIClient,
  AIClientError,
  type AIClient,
  type AIClientMode,
  type AIClientRequestOptions,
  type AISuggestRequest,
  type AISuggestResponse,
  type AISuggestion,
  type AISuggestionType,
  type AISearchRequest,
  type AISearchResponse,
  type AISearchResult,
  type AISummaryRequest,
  type AISummaryResponse,
  type AIHealthResponse
} from './aiClient';
export {
  collectionMeta,
  makeSubtitle,
  workspaceEntries,
  workspaceEntryFromThought,
  toPersistableThought,
  toPersistableDraft,
  stripWorkspaceMetadata,
  metadataFromThought,
  mergeMetadata
} from './workspace';
export type { CollectionId, WorkspaceStatus, WorkspaceEntry } from './workspace';
export {
  readCachedThoughts,
  writeCachedThoughts,
  readCachedCursor,
  writeCachedCursor,
  appendPendingChange,
  readPendingChanges,
  overwritePendingChanges,
  clearPendingChanges,
  type PendingThoughtChange,
  type PendingChangeKind
} from './thoughtCache';
export {
  syncThoughts,
  queuePendingUpsert,
  queuePendingDelete,
  replacePendingChanges,
  clearPending,
  type ThoughtSyncResult
} from './thoughtSync';
export { resolveApiBaseUrl, resolveAiBaseUrl, resolveClientId } from './runtimeEnv';
