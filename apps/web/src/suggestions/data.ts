import type { Thought } from '@enso/core';
import type { CollectionId } from '../workspaceData';

export type SuggestionIntent = 'capture' | 'review' | 'link' | 'revive';

export interface SuggestionNode {
  id: string;
  label: string;
  context: string;
  snippet?: string;
  intent: SuggestionIntent;
  targetThoughtId?: Thought['id'];
  collection: CollectionId;
  action?: () => void;
  tags?: string[];
}

export interface SuggestionGroup {
  id: string;
  heading: string;
  nodes: SuggestionNode[];
}

export interface SuggestionPalette {
  spotlights: SuggestionNode[];
  contextGroup?: SuggestionGroup;
}

export const suggestionSeed: Array<{
  id: string;
  label: string;
  context: string;
  intent: SuggestionIntent;
  collection: CollectionId;
  tags: string[];
  targetThoughtId?: Thought['id'];
  snippet?: string;
}> = [
  {
    id: 's-capture-today',
    label: 'Capture morning reset summary',
    context: 'Daily review • last run 15m ago',
    intent: 'capture',
    collection: 'daily-review',
    tags: ['ritual'],
    targetThoughtId: 'th-capture-ritual'
  },
  {
    id: 's-link-graph',
    label: 'Link new idea to graph layering',
    context: 'Projects • Graph studio',
    intent: 'link',
    collection: 'projects',
    tags: ['graph', 'ui'],
    targetThoughtId: 'th-graph-connections',
    snippet: 'Overlay related clusters with sparklines to visualise activity.'
  },
  {
    id: 's-review-sync',
    label: 'Continue offline sync handshake note',
    context: 'Projects • System design',
    intent: 'review',
    collection: 'projects',
    tags: ['sync'],
    targetThoughtId: 'th-offline-handshake',
    snippet: 'Step two confirms merge with remote conflict agent and logs timeline.'
  },
  {
    id: 's-revive-tag',
    label: 'Revive tag taxonomy refresh',
    context: 'Inbox • Edited 2h ago',
    intent: 'revive',
    collection: 'inbox',
    tags: ['tags'],
    targetThoughtId: 'th-tag-refresh'
  },
  {
    id: 's-capture-voice-follow',
    label: 'Capture follow-up on voice capture spike',
    context: 'Inbox • Experiment notes',
    intent: 'capture',
    collection: 'inbox',
    tags: ['voice', 'mobile'],
    targetThoughtId: 'th-voice-capture',
    snippet: 'Latency below 250ms on-device; need fallback prompt when speech fails.'
  },
  {
    id: 's-review-archive-sprint',
    label: 'Revisit sprint 18 retrospective snapshot',
    context: 'Archive • 2 days ago',
    intent: 'review',
    collection: 'archive',
    tags: ['retrospective', 'team'],
    targetThoughtId: 'th-archive-sprint'
  }
];
