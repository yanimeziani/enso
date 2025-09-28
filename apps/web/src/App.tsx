import React from 'react';
import type { CollectionId, WorkspaceStatus, WorkspaceEntry } from './workspaceData';
import { workspaceEntries } from './workspaceData';
import { useWorkspace } from './hooks/useWorkspace';
import { useSuggestionPalette } from './suggestions/useSuggestionPalette';
import { CommandPalette } from './suggestions/CommandPalette';
import type { SuggestionNode } from './suggestions/data';
import { CaptureBox, CaptureBoxHandle } from './components/CaptureBox';
import { CaptureEditor } from './components/CaptureEditor';
import { FlowList } from './components/FlowList';

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

type UsageState = {
  captures: number;
  focusCaptures: number;
  tagCaptures: number;
  paletteActivations: number;
};

const DEFAULT_USAGE: UsageState = {
  captures: 0,
  focusCaptures: 0,
  tagCaptures: 0,
  paletteActivations: 0
};

const USAGE_STORAGE_KEY = 'enso.usage.v1';
const CAPTURE_VISIBILITY_STORAGE_KEY = 'enso.capture.visibility.v1';

type CaptureVisibility = 'expanded' | 'collapsed' | 'hidden';

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
    updateThought,
    createThought,
    updateStatus,
    getEntrySnapshot,
    replaceEntry,
    removeThought,
    nowEntries,
    inboxEntries
  } = useWorkspace(workspaceEntries);

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
  const [captureVisibility, setCaptureVisibility] = React.useState<CaptureVisibility>(() => {
    if (typeof window === 'undefined') {
      return 'expanded';
    }
    try {
      const stored = window.localStorage.getItem(CAPTURE_VISIBILITY_STORAGE_KEY);
      if (stored === 'collapsed' || stored === 'hidden') {
        return stored;
      }
    } catch (error) {
      console.warn('Unable to read capture visibility cache', error);
    }
    return 'expanded';
  });

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [paletteQuery, setPaletteQuery] = React.useState('');
  const [highlightIndex, setHighlightIndex] = React.useState(-1);
  const saveTimeoutRef = React.useRef<number | null>(null);
  const settleTimeoutRef = React.useRef<number | null>(null);
  const syncTimeoutRef = React.useRef<number | null>(null);
  const [savingState, setSavingState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const captureRef = React.useRef<CaptureBoxHandle | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [activeTag, setActiveTag] = React.useState<'all' | string>('all');
  const [syncState, setSyncState] = React.useState<'idle' | 'pending' | 'conflict'>('idle');
  const [recentlyMovedId, setRecentlyMovedId] = React.useState<string | null>(null);
  const recentMoveTimeoutRef = React.useRef<number | null>(null);
  const [undoState, setUndoState] = React.useState<UndoState | null>(null);
  const undoTimeoutRef = React.useRef<number | null>(null);
  const [toolbarExpanded, setToolbarExpanded] = React.useState(false);
  const focusCapture = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => captureRef.current?.focus());
      return;
    }
    captureRef.current?.focus();
  }, []);
  const ensureCaptureExpanded = React.useCallback(() => {
    let changed = false;
    setCaptureVisibility((current) => {
      if (current === 'expanded') {
        return current;
      }
      changed = true;
      return 'expanded';
    });
    return changed;
  }, []);
  const toggleCaptureCollapse = React.useCallback(() => {
    setCaptureVisibility((current) => (current === 'collapsed' ? 'expanded' : 'collapsed'));
  }, []);
  const dismissCapture = React.useCallback(() => {
    setCaptureVisibility('hidden');
  }, []);
  const revealCapture = React.useCallback(() => {
    const changed = ensureCaptureExpanded();
    if (changed) {
      if (typeof window !== 'undefined') {
        window.setTimeout(() => focusCapture(), 0);
      } else {
        focusCapture();
      }
      return;
    }
    focusCapture();
  }, [ensureCaptureExpanded, focusCapture]);
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

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(CAPTURE_VISIBILITY_STORAGE_KEY, captureVisibility);
    } catch (error) {
      console.warn('Unable to persist capture visibility', error);
    }
  }, [captureVisibility]);

  const markUnsynced = React.useCallback((source: 'capture' | 'edit') => {
    setSyncState((current) => {
      const nextState = current === 'pending' && source === 'capture' ? 'conflict' : 'pending';
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      if (nextState === 'pending') {
        syncTimeoutRef.current = window.setTimeout(() => {
          setSyncState('idle');
          syncTimeoutRef.current = null;
        }, source === 'capture' ? 1400 : 900);
      }
      return nextState;
    });
  }, []);

  const resolveConflicts = React.useCallback(() => {
    setSyncState('pending');
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = window.setTimeout(() => {
      setSyncState('idle');
      syncTimeoutRef.current = null;
    }, 1200);
  }, []);

  const activeTags = React.useMemo(() => {
    if (activeTag !== 'all') {
      return [activeTag];
    }

    return activeThought?.thought.tags ?? [];
  }, [activeTag, activeThought]);

  const palette = useSuggestionPalette({
    query: paletteQuery,
    activeCollection,
    activeThoughtId: activeThought?.thought.id,
    activeTags
  });

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
    setPaletteOpen(true);
  }, [registerPaletteActivation]);

  const closePalette = React.useCallback(() => {
    setPaletteOpen(false);
    setHighlightIndex(-1);
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
    [activeCollection, closePalette, selectThought, setActiveTag, setCollection]
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
    ({ text, tags, focus, project }: { text: string; tags: string[]; focus: boolean; project?: string }) => {
      const previousCollection = activeCollection;
      const previousActiveThoughtId = activeThought?.thought.id ?? '';
      const previousActiveTag = activeTag;
      const collection: CollectionId = project ? 'projects' : focus ? 'daily-review' : 'inbox';
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

  const handleCreateThought = () => {
    setToolbarExpanded(true);
    const changed = ensureCaptureExpanded();
    if (changed) {
      if (typeof window !== 'undefined') {
        window.setTimeout(() => focusCapture(), 0);
      } else {
        focusCapture();
      }
      return;
    }
    focusCapture();
  };

  const toggleToolbar = React.useCallback(() => {
    if (toolbarExpanded) {
      setToolbarExpanded(false);
      return;
    }
    handleCreateThought();
  }, [handleCreateThought, toolbarExpanded]);

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

  const searchTerm = React.useMemo(() => query.trim().toLowerCase(), [query]);
  const searchActive = Boolean(searchTerm);

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
      return 'Capture what’s on your mind. Add details later if needed.';
    }
    return 'Capture what’s on your mind. Layer #tags or !focus when it helps.';
  }, [advancedUnlocked, usage.captures]);
  const showCommandShortcuts = usage.captures >= 1 || advancedUnlocked;

  const openPaletteFromCapture = React.useCallback(() => {
    setPaletteQuery('');
    setHighlightIndex(0);
    openPalette();
  }, [openPalette]);

  const editorMicrocopy = React.useMemo(() => {
    if (!activeThought) {
      if (searchActive) {
        return 'Search or pick a thought from the toolbox to start editing.';
      }

      if (collectionEntries.length) {
        return 'Select a thought from the toolbox to open it in the editor.';
      }

      return 'Capture something new from the toolbox to begin.';
    }

    return 'Draft in markdown. Use the toolbox to switch context or capture quick ideas.';
  }, [activeThought, collectionEntries.length, searchActive]);

  const activeCollectionSummary = React.useMemo(
    () => collections.find((collection) => collection.id === activeCollection) ?? null,
    [activeCollection, collections]
  );

  const collectionEmptyCopy = React.useMemo(() => {
    if (!searchActive) {
      switch (activeCollection) {
        case 'daily-review':
          return (
            <React.Fragment>
              <span className="flow-list__empty-lead">Nothing in focus yet.</span>
              <span className="flow-list__empty-hint">Capture with !focus from the toolbox to line up deep work.</span>
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
              <span className="flow-list__empty-hint">Capture with @project or move work here from the palette.</span>
              <div className="flow-list__empty-actions">
                <button type="button" className="flow-list__empty-action" onClick={openPaletteFromCapture}>
                  Browse suggestions
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
              <span className="flow-list__empty-hint">Capture something new or promote a project from the palette.</span>
              <div className="flow-list__empty-actions">
                <button type="button" className="flow-list__empty-action" onClick={handleCreateThought}>
                  Capture a thought
                </button>
                <button type="button" className="flow-list__empty-action" onClick={openPaletteFromCapture}>
                  Browse suggestions
                </button>
              </div>
            </React.Fragment>
          );
      }
    }

    return (
      <React.Fragment>
        <span className="flow-list__empty-lead">No matching thoughts.</span>
        <span className="flow-list__empty-hint">Clear the search filter to see everything in this collection.</span>
        <div className="flow-list__empty-actions">
          <button type="button" className="flow-list__empty-action" onClick={handleClearSearch}>
            Clear search
          </button>
        </div>
      </React.Fragment>
    );
  }, [activeCollection, handleClearSearch, handleCreateThought, openPaletteFromCapture, searchActive]);


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
      return `Captured “${title}” to ${destination}.`;
    }

    return `${undoState.label} “${title}”.`;
  }, [undoState]);

  return (
    <main className="capture-shell capture-shell--editor-only">
      <span className="visually-hidden" aria-live="polite">
        {recentlyMovedId ? 'Thought moved to Now.' : ''}
      </span>

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
          <span id="workspace-search-hint" className="capture-shell__search-hint">
            {advancedUnlocked ? 'Press / to search • ⌘ + K for commands' : 'Press / to search'}
          </span>
        </div>
      </header>

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
            />
          ) : (
            <div className="capture-shell__empty-editor capture-shell__empty-editor--full">
              <strong>You're prepped.</strong>
              <span>
                {collectionEntries.length
                  ? 'Select a thought from the toolbox to begin editing.'
                  : 'Capture from the toolbox to get started.'}
              </span>
            </div>
          )}

          <div className="capture-shell__microcopy">{editorMicrocopy}</div>
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

      {toolbarExpanded ? (
        <div className="capture-shell__toolbar-panel" role="region" aria-label="Toolbox">
          <div className="capture-shell__toolbox">
            {captureVisibility === 'hidden' ? (
              <button type="button" className="capture-shell__toolbar-reveal" onClick={revealCapture}>
                Show quick capture
              </button>
            ) : (
              <CaptureBox
                ref={captureRef}
                onCapture={handleCapture}
                suggestions={captureSuggestions}
                onCommandPalette={openPaletteFromCapture}
                placeholder={capturePlaceholder}
                isCollapsed={captureVisibility === 'collapsed'}
                onCollapseToggle={toggleCaptureCollapse}
                onDismiss={dismissCapture}
                showCommandShortcuts={showCommandShortcuts}
              />
            )}

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
                <span>Captured today</span>
                <strong>{metrics.capturedToday}</strong>
              </div>
              <div className="toolbox-metric">
                <span>High-energy</span>
                <strong>{metrics.highEnergyCount}</strong>
              </div>
            </div>

            {activeThought ? (
              <div className="capture-shell__toolbox-section capture-shell__toolbox-current">
                <h3>Current thought</h3>
                <div className="toolbox-current__momentum">
                  <div className="toolbox-current__momentum-heading">
                    <span>Momentum</span>
                    <strong>{momentumLabel[activeThought.momentum]}</strong>
                  </div>
                  <div
                    className="context-progress"
                    role="img"
                    aria-label={`Momentum at ${momentumProgress[activeThought.momentum]} percent`}
                  >
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
        </div>
      ) : null}

      <nav
        className={`capture-shell__bottom-nav${toolbarExpanded ? ' capture-shell__bottom-nav--expanded' : ' capture-shell__bottom-nav--collapsed'}`}
        aria-label="Sections"
      >
        <button
          type="button"
          className="capture-shell__nav-toggle"
          onClick={toggleToolbar}
          aria-expanded={toolbarExpanded}
          aria-label={toolbarExpanded ? 'Hide toolbox' : 'Open toolbox'}
        >
          <span className="capture-shell__nav-toggle-icon" aria-hidden="true">
            {toolbarExpanded ? '×' : '+'}
          </span>
          <span className="capture-shell__nav-toggle-hint" aria-hidden="true">
            ⌘ + Enter
          </span>
        </button>
        <div
          className={`capture-shell__nav-items${toolbarExpanded ? ' capture-shell__nav-items--visible' : ''}`}
          aria-hidden={!toolbarExpanded}
        >
          {navItems.map((item) => {
            const isActive = item.id === activeCollection;
            return (
              <button
                key={item.id}
                type="button"
                className={`capture-shell__nav-button${isActive ? ' capture-shell__nav-button--active' : ''}`}
                onClick={() => {
                  setCollection(item.id);
                }}
                aria-pressed={isActive}
                aria-label={`${item.label}${item.count ? ` (${item.count} items)` : ''}`}
                tabIndex={toolbarExpanded ? 0 : -1}
              >
                <span className="capture-shell__nav-label">{item.label}</span>
                {item.count ? (
                  <span className="capture-shell__nav-badge" aria-hidden="true">
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        onQueryChange={handlePaletteQueryChange}
        palette={palette}
        highlightIndex={highlightIndex}
        onHover={handleSuggestionHover}
        onSelect={handleSuggestionSelect}
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
