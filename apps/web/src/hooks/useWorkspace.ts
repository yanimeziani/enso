import { useEffect, useMemo, useState, useCallback } from 'react';
import { matchesQuery, normalizeThought } from '@thoughtz/core';
import type { Thought } from '@thoughtz/core';
import type { CollectionId, WorkspaceEntry, WorkspaceStatus } from '../workspaceData';

export interface WorkspaceMetrics {
  capturedToday: number;
  highEnergyCount: number;
  activeMomentum: 'flow' | 'steady' | 'parked';
}

interface CollectionSummary {
  id: CollectionId;
  label: string;
  hint: string;
  count: number;
}

interface WorkspaceState {
  collections: CollectionSummary[];
  activeCollection: CollectionId;
  setCollection: (collection: CollectionId) => void;
  tags: string[];
  query: string;
  setQuery: (value: string) => void;
  entries: WorkspaceEntry[];
  activeThought: WorkspaceEntry | null;
  selectThought: (id: Thought['id']) => void;
  metrics: WorkspaceMetrics;
  updateThought: (id: Thought['id'], patch: { title?: string; content?: string; tags?: string[] }) => void;
  createThought: (input: {
    content: string;
    tags: string[];
    title?: string;
    collection?: CollectionId;
    status?: WorkspaceStatus;
  }) => WorkspaceEntry;
  updateStatus: (id: Thought['id'], status: WorkspaceStatus) => void;
  getEntrySnapshot: (id: Thought['id']) => WorkspaceEntry | null;
  replaceEntry: (entry: WorkspaceEntry) => void;
  removeThought: (id: Thought['id']) => WorkspaceEntry | null;
  nowEntries: WorkspaceEntry[];
  inboxEntries: WorkspaceEntry[];
}

const collectionMeta: Record<CollectionId, { label: string; hint: string }> = {
  inbox: {
    label: 'Inbox',
    hint: 'Fresh captures waiting for triage'
  },
  'daily-review': {
    label: 'Daily Review',
    hint: 'Focus blocks for today’s loop'
  },
  projects: {
    label: 'Projects',
    hint: 'In-flight initiatives and research'
  },
  archive: {
    label: 'Archive',
    hint: 'Completed loops and references'
  }
};

const cloneEntry = (entry: WorkspaceEntry): WorkspaceEntry => ({
  ...entry,
  thought: {
    ...entry.thought,
    tags: [...entry.thought.tags]
  },
  activityTrend: entry.activityTrend ? [...entry.activityTrend] : undefined
});

const isToday = (iso: string) => {
  const updated = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - updated.getTime();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  return diff < ONE_DAY;
};

export const useWorkspace = (entries: WorkspaceEntry[]): WorkspaceState => {
  const [entriesState, setEntriesState] = useState<WorkspaceEntry[]>(() => entries);
  const [activeCollection, setActiveCollection] = useState<CollectionId>('daily-review');
  const [query, setQuery] = useState('');
  const [activeThoughtId, setActiveThoughtId] = useState<string>('');

  const collectionSummaries: CollectionSummary[] = useMemo(() => {
    return (Object.keys(collectionMeta) as CollectionId[]).map((id) => {
      const count = entriesState.filter((entry) => entry.collection === id).length;
      return {
        id,
        label: collectionMeta[id].label,
        hint: collectionMeta[id].hint,
        count
      };
    });
  }, [entriesState]);

  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    entriesState.forEach((entry) => {
      entry.thought.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [entriesState]);

  const filteredEntries = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();

    return entriesState.filter((entry) => {
      if (entry.collection !== activeCollection) {
        return false;
      }

      if (loweredQuery && !matchesQuery(entry.thought, loweredQuery)) {
        return false;
      }

      return true;
    });
  }, [entriesState, activeCollection, query]);

  const activeThought = useMemo(() => {
    if (!activeThoughtId) {
      return null;
    }

    return filteredEntries.find((entry) => entry.thought.id === activeThoughtId) ?? null;
  }, [filteredEntries, activeThoughtId]);

  useEffect(() => {
    if (!activeThoughtId) {
      return;
    }

    const stillExists = filteredEntries.some((entry) => entry.thought.id === activeThoughtId);
    if (!stillExists) {
      setActiveThoughtId('');
    }
  }, [filteredEntries, activeThoughtId]);

  const metrics: WorkspaceMetrics = useMemo(() => {
    const capturedToday = entriesState.filter((entry) => isToday(entry.thought.updatedAt)).length;
    const highEnergyCount = filteredEntries.filter((entry) => entry.energy === 'high').length;
    const activeMomentum = activeThought?.momentum ?? 'steady';

    return {
      capturedToday,
      highEnergyCount,
      activeMomentum
    };
  }, [entriesState, filteredEntries, activeThought]);

  const updateThought = useCallback(
    (id: Thought['id'], patch: { title?: string; content?: string; tags?: string[] }) => {
      setEntriesState((prev) =>
        prev.map((entry) => {
          if (entry.thought.id !== id) {
            return entry;
          }

          const nextThought: Thought = {
            ...entry.thought,
            ...patch,
            updatedAt: new Date().toISOString()
          };

          return {
            ...entry,
            thought: nextThought,
            subtitle: `${collectionMeta[entry.collection].label} • just now`
          };
        })
      );
    },
    []
  );

  const nowEntries = useMemo(() => entriesState.filter((entry) => entry.status === 'now'), [entriesState]);
  const inboxEntries = useMemo(() => entriesState.filter((entry) => entry.status === 'inbox'), [entriesState]);

  const updateStatus = useCallback((id: Thought['id'], status: WorkspaceStatus) => {
    setEntriesState((prev) =>
      prev.map((entry) =>
        entry.thought.id === id
          ? {
              ...entry,
              status,
              subtitle: status === 'now' ? `${collectionMeta[entry.collection].label} • in focus` : entry.subtitle
            }
          : entry
      )
    );
  }, []);

  const createThought = useCallback(
    ({ content, tags: rawTags, title = '', collection = 'inbox', status = 'inbox' }: { content: string; tags: string[]; title?: string; collection?: CollectionId; status?: WorkspaceStatus }) => {
      const normalizedTags = Array.from(new Set(rawTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
      const base = normalizeThought({
        title: title || (content.split('\n')[0]?.slice(0, 72) ?? 'Untitled thought'),
        content,
        tags: normalizedTags
      });

      const entry: WorkspaceEntry = {
        thought: base,
        subtitle: `${collectionMeta[collection].label} • just now`,
        collection,
        energy: normalizedTags.includes('focus') ? 'high' : 'medium',
        momentum: status === 'now' ? 'flow' : 'steady',
        status
      };

      setEntriesState((prev) => [entry, ...prev]);
      setActiveCollection(collection);
      setActiveThoughtId(base.id);
      return entry;
    },
    []
  );

  const getEntrySnapshot = useCallback(
    (id: Thought['id']) => {
      const entry = entriesState.find((item) => item.thought.id === id);
      return entry ? cloneEntry(entry) : null;
    },
    [entriesState]
  );

  const replaceEntry = useCallback((input: WorkspaceEntry) => {
    const replacement = cloneEntry(input);
    setEntriesState((prev) =>
      prev.map((entry) => (entry.thought.id === replacement.thought.id ? replacement : entry))
    );
  }, []);

  const removeThought = useCallback(
    (id: Thought['id']) => {
      let removed: WorkspaceEntry | null = null;
      setEntriesState((prev) => {
        const next = prev.filter((entry) => {
          if (entry.thought.id === id) {
            removed = entry;
            return false;
          }
          return true;
        });
        return next;
      });

      if (removed && removed.thought.id === activeThoughtId) {
        setActiveThoughtId('');
      }

      return removed ? cloneEntry(removed) : null;
    },
    [activeThoughtId]
  );

  return {
    collections: collectionSummaries,
    activeCollection,
    setCollection: setActiveCollection,
    tags,
    query,
    setQuery,
    entries: filteredEntries,
    activeThought,
    selectThought: setActiveThoughtId,
    metrics,
    updateThought,
    createThought,
    updateStatus,
    getEntrySnapshot,
    replaceEntry,
    removeThought,
    nowEntries,
    inboxEntries
  };
};
