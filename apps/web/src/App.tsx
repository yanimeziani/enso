import React from 'react';
import type { Thought, WorkspaceEntry, AIClientMode, AIHealthResponse } from '@enso/core';
import {
  HttpThoughtRepository,
  workspaceEntryFromThought,
  toPersistableThought,
  readCachedThoughts,
  writeCachedThoughts,
  readPendingChanges,
  appendPendingChange,
  syncThoughts
} from '@enso/core';
import type { CollectionId, WorkspaceStatus } from './workspaceData';
import { workspaceEntries } from './workspaceData';
import { useWorkspace } from './hooks/useWorkspace';
import { useSuggestionPalette } from './suggestions/useSuggestionPalette';
import { CommandPalette } from './suggestions/CommandPalette';
import type { SuggestionNode } from './suggestions/data';
import { CaptureEditor } from './components/CaptureEditor';
import { EditorToolbar } from './components/EditorToolbar';
import { FlowList } from './components/FlowList';
import { configureAIClient, fetchAIHealth } from './services/aiClient';
import { readAISettings, writeAISettings, availableAIModes, type AISettings } from './settings/aiSettings';
import { useAISearchResults } from './hooks/useAISearchResults';
import { useAISummary } from './hooks/useAISummary';

import './App.css';

const ensoLogoUrl = new URL('../../../Enso.svg', import.meta.url).href;

const momentumLabel: Record<'flow' | 'steady' | 'parked', string> = {
  flow: 'In flow',
  steady: 'Steady progress',
  parked: 'Parked for later'
};

const energyLabel: Record<'high' | 'medium' | 'low', string> = {
  high: 'High focus',
  medium: 'Medium focus',
  low: 'Low effort'
};

const momentumProgress: Record<'flow' | 'steady' | 'parked', number> = {
  flow: 85,
  steady: 60,
  parked: 25
};

type AIServiceStatus = 'disabled' | 'checking' | 'ok' | 'unavailable';

type UsageState = {
  captures: number;
  focusCaptures: number;
  tagCaptures: number;
  paletteActivations: number;
};

type PaletteCaptureDefaults = {
  label: string;
  tags: string[];
  collection: CollectionId;
};

const DEFAULT_USAGE: UsageState = {
  captures: 0,
  focusCaptures: 0,
  tagCaptures: 0,
  paletteActivations: 0
};

const USAGE_STORAGE_KEY = 'enso.usage.v1';
type UndoState =
  | {
      kind: 'capture';
      entry: WorkspaceEntry;
      previousCollection: CollectionId;
      previousActiveThoughtId: string;
      previousActiveTag: 'all' | string;
      usageDelta: {
        captures: number;
        focusCaptures: number;
        tagCaptures: number;
      };
    }
  | {
      kind: 'status';
      before: WorkspaceEntry;
      toStatus: WorkspaceStatus;
      label: string;
    };

const cloneEntry = (entry: WorkspaceEntry): WorkspaceEntry => ({
  ...entry,
  thought: {
    ...entry.thought,
    tags: [...entry.thought.tags]
  },
  activityTrend: entry.activityTrend ? [...entry.activityTrend] : undefined
});

const App: React.FC = () => {
  const workspaceState = useWorkspace(workspaceEntries);
  const {
    collections,
    activeCollection,
    setCollection,
    tags,
    query,
    setQuery,
    entries,
    activeThought,
    selectThought,
    metrics,
    updateThought: updateThoughtLocal,
    createThought: createThoughtLocal,
    updateStatus,
    getEntrySnapshot,
    replaceEntry,
    removeThought: removeThoughtLocal,
    nowEntries,
    inboxEntries,
    hydrate
  } = workspaceState;

  const [aiSettings, setAISettings] = React.useState<AISettings>(() => readAISettings());
  const [aiHealth, setAiHealth] = React.useState<AIHealthResponse | null>(null);
  const [aiHealthError, setAiHealthError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    configureAIClient({
      enabled: aiSettings.enabled,
      mode: aiSettings.mode
    });
    writeAISettings(aiSettings);
  }, [aiSettings.enabled, aiSettings.mode]);

  React.useEffect(() => {
    if (!aiSettings.enabled) {
      setAiHealth({ status: 'ok', detail: 'AI suggestions disabled', mode: aiSettings.mode, enabled: false });
      setAiHealthError(null);
      return;
    }

    let cancelled = false;
    fetchAIHealth()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setAiHealth(response);
        setAiHealthError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const detail = error instanceof Error ? error.message : String(error);
        setAiHealth({ status: 'unavailable', detail, mode: aiSettings.mode, enabled: true });
        setAiHealthError(error instanceof Error ? error : new Error(detail));
      });

    return () => {
      cancelled = true;
    };
  }, [aiSettings.enabled, aiSettings.mode]);

  const aiStatus: AIServiceStatus = React.useMemo(() => {
    if (!aiSettings.enabled) {
      return 'disabled';
    }
    if (!aiHealth) {
      return 'checking';
    }
    return aiHealth.status === 'ok' ? 'ok' : 'unavailable';
  }, [aiSettings.enabled, aiHealth]);

  const aiDetail: string | null = React.useMemo(() => {
    if (aiStatus === 'disabled') {
      return 'AI suggestions are turned off.';
    }
    if (aiHealth?.detail) {
      return aiHealth.detail;
    }
    if (aiHealthError) {
      return aiHealthError.message;
    }
    return null;
  }, [aiStatus, aiHealth, aiHealthError]);

  const [usage, setUsage] = React.useState<UsageState>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_USAGE;
    }

    try {
      const stored = window.localStorage.getItem(USAGE_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_USAGE;
      }

      const parsed = JSON.parse(stored) as Partial<UsageState> | null;
      if (!parsed) {
        return DEFAULT_USAGE;
      }

      const safeNumber = (value: unknown): number =>
        typeof value === 'number' && Number.isFinite(value) ? value : 0;

      return {
        captures: safeNumber(parsed.captures),
        focusCaptures: safeNumber(parsed.focusCaptures),
        tagCaptures: safeNumber(parsed.tagCaptures),
        paletteActivations: safeNumber(parsed.paletteActivations)
      };
    } catch (error) {
      console.warn('Unable to parse usage cache', error);
      return DEFAULT_USAGE;
    }
  });
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [paletteQuery, setPaletteQuery] = React.useState('');
  const [highlightIndex, setHighlightIndex] = React.useState(-1);
  const toggleAISettings = React.useCallback(() => {
    setAISettings((current) => ({ ...current, enabled: !current.enabled }));
  }, []);
  const updateAiMode = React.useCallback((mode: AIClientMode) => {
    setAISettings((current) => ({ ...current, mode }));
  }, []);
  const saveTimeoutRef = React.useRef<number | null>(null);
  const settleTimeoutRef = React.useRef<number | null>(null);
  const syncTimeoutRef = React.useRef<number | null>(null);
  const [savingState, setSavingState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [activeTag, setActiveTag] = React.useState<'all' | string>('all');
  const [syncState, setSyncState] = React.useState<'idle' | 'pending' | 'conflict'>('idle');
  const [recentlyMovedId, setRecentlyMovedId] = React.useState<string | null>(null);
  const recentMoveTimeoutRef = React.useRef<number | null>(null);
  const [undoState, setUndoState] = React.useState<UndoState | null>(null);
  const undoTimeoutRef = React.useRef<number | null>(null);
  const [previewMode, setPreviewMode] = React.useState<'overlay' | 'split'>('overlay');
  const [paletteMode, setPaletteMode] = React.useState<'suggestions' | 'capture'>('suggestions');

  const repositoryRef = React.useRef<HttpThoughtRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = new HttpThoughtRepository();
  }
  const repository = repositoryRef.current;

  const [, setThoughts] = React.useState<Thought[]>(() => []);
  const [pendingChanges, setPendingChanges] = React.useState(() => readPendingChanges());

  const sortThoughts = React.useCallback((list: Thought[]): Thought[] => {
    return [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, []);

  const applyThoughtList = React.useCallback(
    (next: Thought[]) => {
      const sorted = sortThoughts(next);
      setThoughts(sorted);
      writeCachedThoughts(sorted);
      hydrate(sorted.map((thought) => workspaceEntryFromThought(thought)));
    },
    [hydrate, sortThoughts]
  );

  const updateThoughtState = React.useCallback(
    (updater: (prev: Thought[]) => Thought[]) => {
      setThoughts((prev) => {
        const next = updater(prev);
        const sorted = sortThoughts(next);
        writeCachedThoughts(sorted);
        hydrate(sorted.map((thought) => workspaceEntryFromThought(thought)));
        return sorted;
      });
    },
    [hydrate, sortThoughts]
  );

  const mergeThoughtLists = React.useCallback((current: Thought[], incoming: Thought[]) => {
    const map = new Map(current.map((thought) => [thought.id, thought]));

    for (const thought of incoming) {
      const existing = map.get(thought.id);
      if (!existing) {
        map.set(thought.id, thought);
        continue;
      }

      const nextTime = Date.parse(thought.updatedAt);
      const currentTime = Date.parse(existing.updatedAt);
      if (Number.isNaN(currentTime) || Number.isNaN(nextTime) || nextTime >= currentTime) {
        map.set(thought.id, thought);
      }
    }

    return Array.from(map.values());
  }, []);

  const applySyncChanges = React.useCallback(
    (changes: Thought[]) => {
      if (!changes.length) {
        return;
      }
      updateThoughtState((prev) => mergeThoughtLists(prev, changes));
    },
    [mergeThoughtLists, updateThoughtState]
  );

  const queuePendingChange = React.useCallback(
    (kind: 'upsert' | 'delete', thought: Thought) => {
      const next = appendPendingChange({ kind, thought });
      setPendingChanges(next);
    },
    []
  );

  React.useEffect(() => {
    const cached = readCachedThoughts();
    if (cached.length) {
      applyThoughtList(cached);
    } else {
      hydrate(workspaceEntries);
    }

    const pending = readPendingChanges();
    setPendingChanges(pending);
    if (pending.length) {
      setSyncState('conflict');
    }

    const loadRemote = async () => {
      try {
        const remote = await repository.list();
        applyThoughtList(remote);
        setSyncState('idle');
      } catch (error) {
        console.warn('Unable to fetch thoughts', error);
        if (!cached.length && pending.length === 0) {
          setSyncState('conflict');
        }
      }
    };

    loadRemote();
  }, [applyThoughtList, hydrate, repository]);

  React.useEffect(() => {
    if (!pendingChanges.length) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setSyncState('pending');
      try {
        const result = await syncThoughts();
        if (!cancelled) {
          applySyncChanges(result.changes);
          setPendingChanges([]);
          setSyncState('idle');
        }
      } catch (error) {
        console.warn('Unable to sync pending thoughts', error);
        if (!cancelled) {
          setSyncState('conflict');
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [pendingChanges, applySyncChanges]);
  const [paletteCaptureDefaults, setPaletteCaptureDefaults] = React.useState<PaletteCaptureDefaults | null>(null);
  const scheduleUndo = React.useCallback((state: UndoState) => {
    if (typeof window !== 'undefined' && undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setUndoState(state);
    if (typeof window !== 'undefined') {
      undoTimeoutRef.current = window.setTimeout(() => {
        setUndoState(null);
        undoTimeoutRef.current = null;
      }, 6000);
    }
  }, []);
  const dismissUndo = React.useCallback(() => {
    if (typeof window !== 'undefined' && undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setUndoState(null);
  }, []);

  const registerPaletteActivation = React.useCallback(() => {
    setUsage((current) => ({
      ...current,
      paletteActivations: current.paletteActivations + 1
    }));
  }, []);

  const markRecentlyMoved = React.useCallback((id: string) => {
    if (recentMoveTimeoutRef.current) {
      window.clearTimeout(recentMoveTimeoutRef.current);
    }

    setRecentlyMovedId(id);
    recentMoveTimeoutRef.current = window.setTimeout(() => {
      setRecentlyMovedId(null);
      recentMoveTimeoutRef.current = null;
    }, 900);
  }, []);

  const advancedUnlocked = React.useMemo(() => {
    if (usage.tagCaptures > 0 || usage.focusCaptures > 0 || usage.paletteActivations > 0) {
      return true;
    }

    return usage.captures >= 10;
  }, [usage]);

  const showFocusHint = advancedUnlocked && usage.focusCaptures < 2;
  const showTagHint = advancedUnlocked && usage.tagCaptures < 3;
  const showVoiceHint = advancedUnlocked && usage.captures >= 1;

  const microcopyTone: 'intro' | 'reinforce' | 'fade' | 'quiet' = React.useMemo(() => {
    if (!advancedUnlocked) {
      return usage.captures === 0 ? 'intro' : 'reinforce';
    }

    if (showFocusHint || showTagHint) {
      return 'reinforce';
    }

    if (usage.captures < 25) {
      return 'fade';
    }

    return 'quiet';
  }, [advancedUnlocked, showFocusHint, showTagHint, usage.captures]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  }, [usage]);

  const markUnsynced = React.useCallback((source: 'capture' | 'edit') => {
    setSyncState((current) => (current === 'conflict' ? current : 'pending'));
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = window.setTimeout(() => {
      setSyncState((current) => (current === 'pending' ? 'idle' : current));
      syncTimeoutRef.current = null;
    }, source === 'capture' ? 1400 : 900);
  }, []);

  const resolveConflicts = React.useCallback(() => {
    const pending = readPendingChanges();
    if (pending.length) {
      setPendingChanges(pending);
      return;
    }

    setSyncState('pending');
    repository
      .list()
      .then((remote) => {
        applyThoughtList(remote);
        setSyncState('idle');
      })
      .catch((error) => {
        console.warn('Failed to refresh thoughts', error);
        setSyncState('conflict');
      });
  }, [applyThoughtList, repository]);

  const createThought = React.useCallback(
    (input: {
      content: string;
      tags: string[];
      title?: string;
      collection?: CollectionId;
      status?: WorkspaceStatus;
    }) => {
      const entry = createThoughtLocal(input);
      const persistable = toPersistableThought(entry);
      updateThoughtState((prev) => mergeThoughtLists(prev, [persistable]));
      markUnsynced('capture');

      void repository
        .create(persistable)
        .then((created) => {
          updateThoughtState((prev) => mergeThoughtLists(prev, [created]));
          replaceEntry(workspaceEntryFromThought(created));
          setSyncState('idle');
        })
        .catch((error) => {
          console.warn('Capture queued for sync', error);
          queuePendingChange('upsert', persistable);
          setSyncState('conflict');
        });

      return entry;
    },
    [createThoughtLocal, mergeThoughtLists, markUnsynced, repository, replaceEntry, updateThoughtState, queuePendingChange]
  );

  const updateThought = React.useCallback(
    (id: Thought['id'], patch: { title?: string; content?: string; tags?: string[] }) => {
      const updatedEntry = updateThoughtLocal(id, patch);
      if (!updatedEntry) {
        return;
      }

      const persistable = toPersistableThought(updatedEntry);
      updateThoughtState((prev) => mergeThoughtLists(prev, [persistable]));
      markUnsynced('edit');

      void repository
        .update(id, {
          title: persistable.title,
          content: persistable.content,
          tags: persistable.tags,
          links: persistable.links,
          updatedAt: persistable.updatedAt
        })
        .then((updated) => {
          updateThoughtState((prev) => mergeThoughtLists(prev, [updated]));
          replaceEntry(workspaceEntryFromThought(updated));
          setSyncState('idle');
        })
        .catch((error) => {
          console.warn('Update queued for sync', error);
          queuePendingChange('upsert', persistable);
          setSyncState('conflict');
        });
    },
    [updateThoughtLocal, updateThoughtState, mergeThoughtLists, markUnsynced, repository, replaceEntry, queuePendingChange]
  );

  const removeThought = React.useCallback(
    (id: Thought['id']) => {
      const removed = removeThoughtLocal(id);
      if (!removed) {
        return null;
      }

      updateThoughtState((prev) => prev.filter((thought) => thought.id !== id));
      markUnsynced('edit');

      void repository
        .remove(id)
        .then(() => {
          setSyncState('idle');
        })
        .catch((error) => {
          console.warn('Unable to delete thought, restoring', error);
          const restored = toPersistableThought(removed);
          updateThoughtState((prev) => mergeThoughtLists(prev, [restored]));
          replaceEntry(removed);
          setSyncState('conflict');
        });

      return removed;
    },
    [removeThoughtLocal, updateThoughtState, markUnsynced, repository, mergeThoughtLists, replaceEntry]
  );

  const activeTags = React.useMemo(() => {
    if (activeTag !== 'all') {
      return [activeTag];
    }

    return activeThought?.thought.tags ?? [];
  }, [activeTag, activeThought]);

  const basePalette = useSuggestionPalette({
    query: paletteQuery,
    activeCollection,
    activeThoughtId: activeThought?.thought.id,
    activeTags
  });

  const aiPaletteNodes = React.useMemo<SuggestionNode[]>(() => {
    const nodes: SuggestionNode[] = [];
    const statusContext = aiStatus === 'unavailable' ? 'Model unavailable' : `Mode: ${aiSettings.mode}`;

    nodes.push({
      id: aiSettings.enabled ? 'ai-disable' : 'ai-enable',
      label: aiSettings.enabled ? 'Disable AI suggestions' : 'Enable AI suggestions',
      context: statusContext,
      intent: 'capture',
      collection: activeCollection,
      action: toggleAISettings,
      snippet: aiDetail ?? undefined
    });

    if (aiSettings.enabled) {
      const modeDescriptions: Record<AIClientMode, string> = {
        auto: 'Let Enso choose the best runner',
        local: 'Prefer on-device model',
        remote: 'Use remote inference endpoint',
        stub: 'Return sample responses'
      };

      availableAIModes
        .filter((mode) => mode !== aiSettings.mode)
        .forEach((mode) => {
          nodes.push({
            id: `ai-mode-${mode}`,
            label: `Switch AI mode to ${mode}`,
            context: modeDescriptions[mode],
            intent: 'capture',
            collection: activeCollection,
            action: () => updateAiMode(mode)
          });
        });
    }

    return nodes;
  }, [aiSettings.enabled, aiSettings.mode, aiStatus, aiDetail, activeCollection, toggleAISettings, updateAiMode]);

  const palette = React.useMemo(() => {
    const mergedSpotlights = [...aiPaletteNodes, ...basePalette.spotlights];
    return {
      spotlights: mergedSpotlights.slice(0, 6),
      contextGroup: basePalette.contextGroup
    };
  }, [aiPaletteNodes, basePalette]);

  const flatSuggestions = React.useMemo(
    () => [...palette.spotlights, ...(palette.contextGroup?.nodes ?? [])],
    [palette]
  );

  React.useEffect(() => {
    if (!paletteOpen) {
      setHighlightIndex(-1);
      return;
    }

    if (highlightIndex >= flatSuggestions.length) {
      setHighlightIndex(flatSuggestions.length ? flatSuggestions.length - 1 : -1);
    }
  }, [paletteOpen, flatSuggestions, highlightIndex]);

  const openPalette = React.useCallback(() => {
    registerPaletteActivation();
    setPaletteMode('suggestions');
    setPaletteCaptureDefaults(null);
    setPaletteOpen(true);
  }, [registerPaletteActivation]);

  const showCaptureCenter = React.useCallback((defaults?: PaletteCaptureDefaults | null) => {
    setPaletteMode('capture');
    setPaletteCaptureDefaults(defaults ?? null);
    setPaletteQuery('');
    setHighlightIndex(-1);
    setPaletteOpen(true);
  }, []);

  const openCaptureCenter = React.useCallback(() => {
    registerPaletteActivation();
    showCaptureCenter(null);
  }, [registerPaletteActivation, showCaptureCenter]);

  const closePalette = React.useCallback(() => {
    setPaletteOpen(false);
    setHighlightIndex(-1);
    setPaletteMode('suggestions');
    setPaletteCaptureDefaults(null);
  }, []);

  React.useEffect(() => {
    const handleGlobalKey = (event: KeyboardEvent) => {
      const rawTarget = event.target as EventTarget | null;
      const elementTarget = rawTarget instanceof HTMLElement ? rawTarget : null;
      const isEditableTarget = Boolean(
        elementTarget &&
          (elementTarget.tagName === 'INPUT' ||
            elementTarget.tagName === 'TEXTAREA' ||
            elementTarget.getAttribute('contenteditable') === 'true' ||
            elementTarget.getAttribute('role') === 'textbox')
      );

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget) {
          return;
        }
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (paletteOpen) {
          closePalette();
        } else {
          setPaletteQuery('');
          setHighlightIndex(0);
          openPalette();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [paletteOpen, openPalette, closePalette, searchInputRef]);

  const handleSuggestionSelect = React.useCallback(
    (node: SuggestionNode) => {
      if (node.action) {
        node.action();
        closePalette();
        setPaletteQuery('');
        return;
      }

      if (node.intent === 'capture') {
        showCaptureCenter({
          label: node.label,
          tags: node.tags ?? [],
          collection: node.collection
        });
        return;
      }

      setActiveTag('all');

      if (node.collection !== activeCollection) {
        setCollection(node.collection);
      }

      if (node.targetThoughtId) {
        selectThought(node.targetThoughtId);
      }

      closePalette();
      setPaletteQuery('');
    },
    [
      activeCollection,
      closePalette,
      selectThought,
      setActiveTag,
      setCollection,
      showCaptureCenter
    ]
  );

  const handleSuggestionHover = React.useCallback((index: number) => {
    setHighlightIndex(index);
  }, []);

  const handlePaletteQueryChange = React.useCallback((value: string) => {
    setPaletteQuery(value);
    setHighlightIndex(0);
  }, []);
  const handleClearSearch = React.useCallback(() => {
    setQuery('');
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    } else {
      searchInputRef.current?.focus();
    }
  }, [setQuery]);

  const handleCapture = React.useCallback(
    ({
      text,
      tags,
      focus,
      project,
      collectionOverride
    }: {
      text: string;
      tags: string[];
      focus: boolean;
      project?: string;
      collectionOverride?: CollectionId;
    }) => {
      const previousCollection = activeCollection;
      const previousActiveThoughtId = activeThought?.thought.id ?? '';
      const previousActiveTag = activeTag;
      const collection: CollectionId =
        collectionOverride ?? (project ? 'projects' : focus ? 'daily-review' : 'inbox');
      const status: WorkspaceStatus = focus ? 'now' : 'inbox';

      const entry = createThought({
        content: text,
        tags,
        collection,
        status
      });

      if (focus) {
        updateStatus(entry.thought.id, 'now');
        markRecentlyMoved(entry.thought.id);
      }

      setActiveTag('all');
      setPaletteQuery('');
      markUnsynced('capture');
      const usageDelta = {
        captures: 1,
        focusCaptures: focus ? 1 : 0,
        tagCaptures: tags.length ? 1 : 0
      };
      setUsage((current) => ({
        ...current,
        captures: current.captures + usageDelta.captures,
        focusCaptures: current.focusCaptures + usageDelta.focusCaptures,
        tagCaptures: current.tagCaptures + usageDelta.tagCaptures
      }));
      scheduleUndo({
        kind: 'capture',
        entry: cloneEntry(entry),
        previousCollection,
        previousActiveThoughtId,
        previousActiveTag,
        usageDelta
      });
    },
    [activeCollection, activeTag, activeThought, createThought, updateStatus, setActiveTag, setPaletteQuery, markUnsynced, setUsage, markRecentlyMoved, scheduleUndo]
  );
  const handleEditorChange = React.useCallback(
    (patch: { title?: string; content?: string; tags?: string[] }) => {
      if (!activeThought) return;
      setSavingState('saving');
      updateThought(activeThought.thought.id, patch);
      markUnsynced('edit');

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        setSavingState('saved');
      }, 400);
    },
    [activeThought, updateThought, markUnsynced]
  );

  React.useEffect(() => {
    if (savingState !== 'saved') {
      return;
    }

    if (settleTimeoutRef.current) {
      window.clearTimeout(settleTimeoutRef.current);
    }

    settleTimeoutRef.current = window.setTimeout(() => {
      setSavingState('idle');
    }, 2000);

    return () => {
      if (settleTimeoutRef.current) {
        window.clearTimeout(settleTimeoutRef.current);
      }
    };
  }, [savingState]);

  React.useEffect(() => {
    setSavingState('idle');
  }, [activeThought?.thought.id]);

  React.useEffect(() => () => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    if (settleTimeoutRef.current) {
      window.clearTimeout(settleTimeoutRef.current);
    }
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }
    if (recentMoveTimeoutRef.current) {
      window.clearTimeout(recentMoveTimeoutRef.current);
      recentMoveTimeoutRef.current = null;
    }
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }, []);

  const handleCreateThought = React.useCallback(() => {
    openCaptureCenter();
  }, [openCaptureCenter]);

  const handleFlowAction = React.useCallback(
    (id: string, action: 'done' | 'focus' | 'archive') => {
      const snapshot = getEntrySnapshot(id);
      if (!snapshot) {
        return;
      }

      if (action === 'focus') {
        updateStatus(id, 'now');
        markUnsynced('edit');
        markRecentlyMoved(id);
        scheduleUndo({
          kind: 'status',
          before: snapshot,
          toStatus: 'now',
          label: 'Moved to Now'
        });
        return;
      }

      if (action === 'done' || action === 'archive') {
        updateStatus(id, 'archive');
        markUnsynced('edit');
        scheduleUndo({
          kind: 'status',
          before: snapshot,
          toStatus: 'archive',
          label: action === 'done' ? 'Marked done' : 'Archived'
        });
      }
    },
    [getEntrySnapshot, updateStatus, markUnsynced, markRecentlyMoved, scheduleUndo]
  );

  const handleTogglePreview = React.useCallback(() => {
    setPreviewMode((current) => (current === 'overlay' ? 'split' : 'overlay'));
  }, []);

  const handlePaletteCaptureSubmit = React.useCallback(
    ({
      text,
      tags,
      focus,
      project,
      collectionOverride
    }: {
      text: string;
      tags: string[];
      focus: boolean;
      project?: string;
      collectionOverride?: CollectionId;
    }) => {
      handleCapture({
        text,
        tags,
        focus,
        project,
        collectionOverride
      });
      closePalette();
    },
    [closePalette, handleCapture]
  );

  const handlePaletteCaptureCancel = React.useCallback(() => {
    setPaletteMode('suggestions');
    setPaletteCaptureDefaults(null);
    setHighlightIndex(0);
  }, []);

  const rawSearchQuery = React.useMemo(() => query.trim(), [query]);
  const searchTerm = React.useMemo(() => rawSearchQuery.toLowerCase(), [rawSearchQuery]);
  const searchActive = Boolean(searchTerm);

  const aiSearch = useAISearchResults(rawSearchQuery, {
    enabled: aiSettings.enabled && aiStatus === 'ok',
    mode: aiSettings.mode,
    debounceMs: 450
  });

  const collectionEntries = entries;

  const allEntries = React.useMemo(() => [...nowEntries, ...inboxEntries], [nowEntries, inboxEntries]);

  const tagSuggestions = React.useMemo(() => {
    const tally = new Map<string, number>();
    const source = searchActive ? collectionEntries : allEntries;

    source.forEach((entry) => {
      entry.thought.tags.forEach((tag) => {
        tally.set(tag, (tally.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);
  }, [allEntries, collectionEntries, searchActive]);

  const captureSuggestions = React.useMemo(
    () => ({
      tagSuggestions: showTagHint ? tagSuggestions : [],
      focusHint: showFocusHint && nowEntries.length === 0 ? 'Add !focus to route this capture into Now.' : undefined,
      showHints: advancedUnlocked,
      showVoiceHint,
      microcopyTone
    }),
    [advancedUnlocked, microcopyTone, nowEntries.length, showFocusHint, showTagHint, showVoiceHint, tagSuggestions]
  );
  const capturePlaceholder = React.useMemo(() => {
    if (usage.captures === 0) {
      return 'Capture a quick thought. Press ⌘ + Enter when ready.';
    }
    if (!advancedUnlocked) {
      return "Capture what's on your mind. Add details later if needed.";
    }
    return "Capture what's on your mind. Layer #tags or !focus when it helps.";
  }, [advancedUnlocked, usage.captures]);
  const showCommandShortcuts = usage.captures >= 1 || advancedUnlocked;

  const captureAiOptions = React.useMemo(
    () => ({
      enabled: aiSettings.enabled && aiStatus === 'ok',
      mode: aiSettings.mode,
      status: aiStatus,
      detail: aiDetail
    }),
    [aiSettings.enabled, aiSettings.mode, aiStatus, aiDetail]
  );

  const openPaletteFromCapture = React.useCallback(() => {
    openCaptureCenter();
  }, [openCaptureCenter]);

  const editorMicrocopy = React.useMemo(() => {
    if (!activeThought) {
      if (searchActive) {
        return 'Search results appear below. Choose a thought to edit.';
      }

      if (collectionEntries.length) {
        return 'Select a thought from the toolbox to open it for editing.';
      }

      return 'Capture a thought from the toolbox to get started.';
    }

    return 'Write in Markdown. Use the toolbox to switch context or capture quick ideas.';
  }, [activeThought, collectionEntries.length, searchActive]);

  const activeCollectionSummary = React.useMemo(
    () => collections.find((collection) => collection.id === activeCollection) ?? null,
    [activeCollection, collections]
  );

  const aiSummary = useAISummary({
    id: activeThought?.thought.id,
    content: activeThought?.thought.content,
    enabled: aiSettings.enabled && aiStatus === 'ok',
    mode: aiSettings.mode
  });

  const collectionEmptyCopy = React.useMemo(() => {
    if (!searchActive) {
      switch (activeCollection) {
        case 'daily-review':
          return (
            <React.Fragment>
              <span className="flow-list__empty-lead">No thoughts in focus yet.</span>
              <span className="flow-list__empty-hint">Capture with !focus in the toolbox to line up deep work.</span>
              <div className="flow-list__empty-actions">
                <button type="button" className="flow-list__empty-action" onClick={handleCreateThought}>
                  Capture a focus thought
                </button>
                <button type="button" className="flow-list__empty-action" onClick={openPaletteFromCapture}>
                  Open command palette
                </button>
              </div>
            </React.Fragment>
          );
        case 'projects':
          return (
            <React.Fragment>
              <span className="flow-list__empty-lead">No projects yet.</span>
              <span className="flow-list__empty-hint">Capture with @project or move work here from the command palette.</span>
              <div className="flow-list__empty-actions">
                <button type="button" className="flow-list__empty-action" onClick={openPaletteFromCapture}>
                  Open command palette
                </button>
              </div>
            </React.Fragment>
          );
        case 'archive':
          return (
            <React.Fragment>
              <span className="flow-list__empty-lead">Archive is quiet.</span>
              <span className="flow-list__empty-hint">Completed thoughts land here after you mark them done.</span>
            </React.Fragment>
          );
        default:
          return (
            <React.Fragment>
              <span className="flow-list__empty-lead">Inbox is clear.</span>
              <span className="flow-list__empty-hint">Capture something new or promote a project from the command palette.</span>
              <div className="flow-list__empty-actions">
                <button type="button" className="flow-list__empty-action" onClick={handleCreateThought}>
                  Capture a thought
                </button>
                <button type="button" className="flow-list__empty-action" onClick={openPaletteFromCapture}>
                  Open command palette
                </button>
              </div>
            </React.Fragment>
          );
      }
    }

    return (
      <React.Fragment>
        <span className="flow-list__empty-lead">No matching thoughts.</span>
        <span className="flow-list__empty-hint">Reset filters to view every thought in this collection.</span>
        <div className="flow-list__empty-actions">
          <button type="button" className="flow-list__empty-action" onClick={handleClearSearch}>
            Clear search
          </button>
        </div>
      </React.Fragment>
    );
  }, [activeCollection, handleClearSearch, handleCreateThought, openPaletteFromCapture, searchActive]);


  const captureToolboxContext = React.useMemo(() => {
    return (
      <div className="capture-shell__toolbox capture-shell__toolbox--command-center">
        <div className="capture-shell__toolbox-section">
          <FlowList
            title={activeCollectionSummary?.label ?? 'Collection'}
            description={activeCollectionSummary?.hint}
            entries={collectionEntries}
            emptyCopy={collectionEmptyCopy}
            onSelect={(id) => {
              selectThought(id);
            }}
            onAction={handleFlowAction}
            activeId={activeThought?.thought.id}
            showAdvanced={advancedUnlocked}
            highlightId={recentlyMovedId ?? undefined}
          />
        </div>

        <div className="capture-shell__toolbox-section capture-shell__toolbox-metrics">
          <div className="toolbox-metric">
            <span>Captured Today</span>
            <strong>{metrics.capturedToday}</strong>
          </div>
          <div className="toolbox-metric">
            <span>High Energy</span>
            <strong>{metrics.highEnergyCount}</strong>
          </div>
        </div>

        {activeThought ? (
          <div className="capture-shell__toolbox-section capture-shell__toolbox-current">
            <h3>Current Thought</h3>
            <div className="toolbox-current__momentum">
              <div className="toolbox-current__momentum-heading">
                <span>Momentum</span>
                <strong>{momentumLabel[activeThought.momentum]}</strong>
              </div>
              <div className="context-progress" role="img" aria-label={`Momentum at ${momentumProgress[activeThought.momentum]} percent`}>
                <div className="context-progress__bar" style={{ width: `${momentumProgress[activeThought.momentum]}%` }} />
              </div>
              <span className="context-progress__meta">Energy: {energyLabel[activeThought.energy]}</span>
              <span className="context-progress__meta">Last edited {formatRelativeUpdatedAt(activeThought.thought.updatedAt)}</span>
              {activeThought.activityTrend ? (
                <span className="context-progress__meta">Focus streak: {computeFocusStreak(activeThought.activityTrend)} day(s)</span>
              ) : null}
            </div>
            {activeThought.thought.tags.length ? (
              <div className="toolbox-current__tags">
                {activeThought.thought.tags.map((tag) => (
                  <span key={tag} className="context-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }, [
    activeCollectionSummary,
    collectionEntries,
    collectionEmptyCopy,
    selectThought,
    handleFlowAction,
    activeThought,
    advancedUnlocked,
    recentlyMovedId,
    metrics
  ]);

  const handleUndo = React.useCallback(() => {
    if (!undoState) {
      return;
    }

    if (undoState.kind === 'capture') {
      const removed = removeThought(undoState.entry.thought.id);
      if (removed) {
        setUsage((current) => ({
          ...current,
          captures: Math.max(0, current.captures - undoState.usageDelta.captures),
          focusCaptures: Math.max(0, current.focusCaptures - undoState.usageDelta.focusCaptures),
          tagCaptures: Math.max(0, current.tagCaptures - undoState.usageDelta.tagCaptures)
        }));
        setCollection(undoState.previousCollection);
        setActiveTag(undoState.previousActiveTag);
        if (undoState.previousActiveThoughtId) {
          selectThought(undoState.previousActiveThoughtId);
        } else {
          selectThought('');
        }
        if (typeof window !== 'undefined' && recentMoveTimeoutRef.current) {
          window.clearTimeout(recentMoveTimeoutRef.current);
          recentMoveTimeoutRef.current = null;
        }
        setRecentlyMovedId(null);
      }
    }

    if (undoState.kind === 'status') {
      replaceEntry(undoState.before);
      if (undoState.before.status === 'now') {
        markRecentlyMoved(undoState.before.thought.id);
      }
      if (undoState.before.status === 'inbox') {
        setActiveTag('all');
      }
    }

    setSyncState('idle');
    if (typeof window !== 'undefined' && syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    dismissUndo();
  }, [dismissUndo, markRecentlyMoved, removeThought, replaceEntry, selectThought, setActiveTag, setCollection, setRecentlyMovedId, setSyncState, setUsage, syncTimeoutRef, undoState]);

  const navItems = React.useMemo(
    () =>
      collections.map((collection) => ({
        id: collection.id,
        label: collection.label,
        count: collection.count
      })),
    [collections]
  );
  const undoMessage = React.useMemo(() => {
    if (!undoState) {
      return '';
    }

    const title =
      (undoState.kind === 'capture' ? undoState.entry.thought.title : undoState.before.thought.title) || 'Untitled thought';

    if (undoState.kind === 'capture') {
      const destination = (() => {
        switch (undoState.entry.collection) {
          case 'daily-review':
            return 'Now';
          case 'projects':
            return 'Projects';
          case 'archive':
            return 'Archive';
          default:
            return 'Inbox';
        }
      })();
      return `Captured "${title}" to ${destination}.`;
    }

    return `${undoState.label} "${title}".`;
  }, [undoState]);

  return (
    <main className="capture-shell capture-shell--editor-only">
      <header className="capture-shell__header">
        <div className="capture-shell__header-leading">
          <div className="capture-shell__branding">
            <img src={ensoLogoUrl} alt="Enso logo" className="capture-shell__logo" />
            <h1>Enso</h1>
          </div>
          <div className={`sync-indicator sync-indicator--${syncState}`} role="status">
            <span className="sync-indicator__dot" aria-hidden="true" />
            <span>
              {syncState === 'idle' && 'Synced'}
              {syncState === 'pending' && 'Syncing…'}
              {syncState === 'conflict' && 'Sync conflict'}
            </span>
            {syncState === 'conflict' ? (
              <button type="button" onClick={resolveConflicts} className="sync-indicator__action">
                Resolve
              </button>
            ) : null}
          </div>
        </div>

        <div className="capture-shell__search">
          <label className="visually-hidden" htmlFor="workspace-search">
            Search thoughts
          </label>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor">
            <path d="M15.5 15.5L20 20" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10.5" cy="10.5" r="5.5" strokeWidth="2" />
          </svg>
          <input
            ref={searchInputRef}
            id="workspace-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                setQuery('');
                event.currentTarget.blur();
              }
            }}
            placeholder="Search thoughts, tags, or projects"
            aria-label="Search thoughts"
            aria-describedby="workspace-search-hint"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="capture-shell__search-clear"
              onClick={handleClearSearch}
              title="Clear search"
              aria-label="Clear search"
              aria-controls="workspace-search"
            >
              <span aria-hidden="true">Clear</span>
            </button>
          ) : null}
          <span id="workspace-search-hint" className="capture-shell__search-hint">
            {advancedUnlocked ? 'Press / to focus search. Press ⌘ + K for commands.' : 'Press / to focus search.'}
          </span>
          {aiSettings.enabled ? (
            <div className="capture-shell__search-ai" aria-live="polite">
              <span className="capture-shell__search-ai-label">AI</span>
              {aiStatus === 'checking' ? (
                <span className="capture-shell__search-ai-status">Checking availability…</span>
              ) : aiStatus === 'unavailable' ? (
                <span className="capture-shell__search-ai-status">
                  Model unavailable{aiDetail ? ` – ${aiDetail}` : ''}
                </span>
              ) : aiSearch.status === 'loading' ? (
                <span className="capture-shell__search-ai-status">Thinking…</span>
              ) : aiSearch.status === 'error' ? (
                <button type="button" className="capture-shell__search-ai-retry" onClick={aiSearch.refresh}>
                  Retry AI search
                </button>
              ) : aiSearch.results.length ? (
                <ul className="capture-shell__search-ai-results">
                  {aiSearch.results.slice(0, 2).map((result, index) => (
                    <li key={`${result.id ?? 'ai-result'}-${index}`}>
                      <strong>{result.title}</strong>
                      <span>{result.snippet}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="capture-shell__search-ai-status">No smart matches yet.</span>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <EditorToolbar
        navItems={navItems}
        activeCollection={activeCollection}
        onSelectCollection={setCollection}
        onOpenPalette={openPalette}
        onOpenCaptureCenter={openCaptureCenter}
        onTogglePreview={handleTogglePreview}
        previewMode={previewMode}
        activeThoughtTitle={activeThought?.thought.title}
        activeThoughtUpdatedAt={activeThought ? formatRelativeUpdatedAt(activeThought.thought.updatedAt) : undefined}
      />

      <section className="capture-shell__editor-wrapper capture-shell__editor-wrapper--full">
        <div className="capture-shell__editor-scroll">
          {activeThought ? (
            <CaptureEditor
              title={activeThought.thought.title}
              content={activeThought.thought.content}
              tags={activeThought.thought.tags}
              updatedAt={activeThought.thought.updatedAt}
              savingState={savingState}
              onChange={handleEditorChange}
              tagOptions={tags}
              previewMode={previewMode}
            />
          ) : (
            <div className="capture-shell__empty-editor capture-shell__empty-editor--full">
              <strong>Ready to capture.</strong>
              <span>
                {collectionEntries.length
                  ? 'Choose a thought from the toolbox to start editing.'
                  : 'Capture a thought from the toolbox to get started.'}
              </span>
            </div>
          )}

          <div className="capture-shell__microcopy">{editorMicrocopy}</div>

          {aiSettings.enabled && activeThought ? (
            <div className="capture-shell__ai-summary" aria-live="polite">
              <div className="capture-shell__ai-summary-heading">
                <span className="capture-shell__ai-summary-title">AI summary</span>
                {aiDetail ? <span className="capture-shell__ai-summary-note">{aiDetail}</span> : null}
                {aiSettings.enabled && aiStatus === 'ok' && aiSummary.status === 'error' ? (
                  <button type="button" className="capture-shell__ai-summary-action" onClick={aiSummary.refresh}>
                    Retry
                  </button>
                ) : null}
              </div>
              {aiStatus === 'checking' ? (
                <p className="capture-shell__ai-summary-status">Checking availability…</p>
              ) : aiStatus === 'unavailable' ? (
                <p className="capture-shell__ai-summary-status">Model unavailable. Start the local service to see summaries.</p>
              ) : aiSummary.status === 'loading' ? (
                <p className="capture-shell__ai-summary-status">Summarising note…</p>
              ) : aiSummary.status === 'success' && aiSummary.data ? (
                <div className="capture-shell__ai-summary-body">
                  <p>{aiSummary.data.summary}</p>
                  {aiSummary.data.highlights && aiSummary.data.highlights.length ? (
                    <ul>
                      {aiSummary.data.highlights.map((highlight, index) => (
                        <li key={`highlight-${index}`}>{highlight}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="capture-shell__ai-summary-actions">
                    <button type="button" onClick={aiSummary.refresh} className="capture-shell__ai-summary-action">
                      Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <p className="capture-shell__ai-summary-status">AI summary will appear after you edit this note.</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {undoState ? (
        <aside className="capture-shell__undo" role="status" aria-live="polite">
          <div className="capture-shell__undo-text">{undoMessage}</div>
          <div className="capture-shell__undo-actions">
            <button type="button" className="capture-shell__undo-button" onClick={handleUndo}>
              Undo
            </button>
            <button
              type="button"
              className="capture-shell__undo-dismiss"
              onClick={dismissUndo}
              aria-label="Dismiss undo notification"
            >
              ×
            </button>
          </div>
        </aside>
      ) : null}

      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        captureDefaults={paletteCaptureDefaults ?? undefined}
        query={paletteMode === 'capture' ? '' : paletteQuery}
        onQueryChange={handlePaletteQueryChange}
        palette={palette}
        highlightIndex={highlightIndex}
        onHover={handleSuggestionHover}
        onSelect={handleSuggestionSelect}
        onCaptureSubmit={handlePaletteCaptureSubmit}
        onCaptureCancel={handlePaletteCaptureCancel}
        captureBoxConfig={{
          suggestions: captureSuggestions,
          placeholder: capturePlaceholder,
          showCommandShortcuts,
          aiOptions: captureAiOptions
        }}
        captureContext={captureToolboxContext}
        onClose={() => {
          closePalette();
          setPaletteQuery('');
        }}
      />
    </main>
  );
};

export default App;

function formatRelativeUpdatedAt(iso: string): string {
  const updated = new Date(iso);
  const difference = Date.now() - updated.getTime();
  const minutes = Math.round(difference / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function computeFocusStreak(trend: number[]): number {
  let streak = 0;
  for (let index = trend.length - 1; index >= 0; index -= 1) {
    if (trend[index] > 0) {
      streak += 1;
    } else {
      break;
    }
  }
  return Math.max(1, streak);
}
