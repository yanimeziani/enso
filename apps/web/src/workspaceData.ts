import { normalizeThought } from '@thoughtz/core';
import type { Thought } from '@thoughtz/core';

export type CollectionId = 'inbox' | 'daily-review' | 'projects' | 'archive';

export type WorkspaceStatus = 'now' | 'inbox' | 'snoozed' | 'archive';

export interface WorkspaceEntry {
  thought: Thought;
  subtitle: string;
  collection: CollectionId;
  energy: 'high' | 'medium' | 'low';
  momentum: 'flow' | 'steady' | 'parked';
  status: WorkspaceStatus;
  activityTrend?: number[];
}

const iso = (input: string) => new Date(input).toISOString();

export const workspaceEntries: WorkspaceEntry[] = [
  {
    thought: normalizeThought({
      id: 'th-capture-ritual',
      title: 'Capture ritual: morning reset',
      content:
        'Three-breath pause before the day starts. Capture loose threads, triage into projects, and mark one focus outcome for the next 90 minutes.',
      tags: ['ritual', 'morning', 'focus'],
      createdAt: iso('2025-09-27T07:25:00Z'),
      updatedAt: iso('2025-09-27T09:05:00Z')
    }),
    subtitle: 'Daily review • 15 minutes ago',
    collection: 'daily-review',
    energy: 'high',
    momentum: 'flow',
    status: 'now',
    activityTrend: [6, 9, 8, 12, 14, 16, 15]
  },
  {
    thought: normalizeThought({
      id: 'th-graph-connections',
      title: 'Graph layering for related thoughts',
      content:
        'Experiment with lightweight overlays that surface 3-hop relationships. Use sparklines to show how active a cluster was over the last week.',
      tags: ['graph', 'ui', 'exploration'],
      createdAt: iso('2025-09-24T16:10:00Z'),
      updatedAt: iso('2025-09-27T08:32:00Z')
    }),
    subtitle: 'Project: Graph studio • 33 minutes ago',
    collection: 'projects',
    energy: 'medium',
    momentum: 'steady',
    status: 'now',
    activityTrend: [2, 4, 6, 4, 5, 7, 9]
  },
  {
    thought: normalizeThought({
      id: 'th-offline-handshake',
      title: 'Offline sync handshake notes',
      content:
        'Design a two-step handshake for offline edits: (1) capture diff bundle, (2) confirm merge with remote conflict agent. Log timeline for debugging.',
      tags: ['sync', 'offline', 'infra'],
      createdAt: iso('2025-09-25T11:45:00Z'),
      updatedAt: iso('2025-09-27T08:05:00Z')
    }),
    subtitle: 'System design • 1 hour ago',
    collection: 'projects',
    energy: 'high',
    momentum: 'flow',
    status: 'now',
    activityTrend: [1, 3, 5, 6, 8, 7, 10]
  },
  {
    thought: normalizeThought({
      id: 'th-tag-refresh',
      title: 'Tag taxonomy refresh',
      content:
        'Consolidate redundant tags ("workflow" vs "process"). Add guidance for energy-based tags: high-focus, low-friction, admin, creative.',
      tags: ['tags', 'taxonomy', 'cleanup'],
      createdAt: iso('2025-09-26T14:22:00Z'),
      updatedAt: iso('2025-09-27T06:55:00Z')
    }),
    subtitle: 'Inbox tidy-up • 2 hours ago',
    collection: 'inbox',
    energy: 'medium',
    momentum: 'steady',
    status: 'inbox',
    activityTrend: [3, 3, 2, 4, 5, 4, 6]
  },
  {
    thought: normalizeThought({
      id: 'th-voice-capture',
      title: 'Voice capture spike learnings',
      content:
        'Latency acceptable under 250ms on-device. Need a fallback text prompt when speech fails. Consider automatic summarization for long captures.',
      tags: ['voice', 'capture', 'mobile'],
      createdAt: iso('2025-09-23T10:18:00Z'),
      updatedAt: iso('2025-09-27T05:40:00Z')
    }),
    subtitle: 'Experiment • 3 hours ago',
    collection: 'inbox',
    energy: 'low',
    momentum: 'steady',
    status: 'inbox',
    activityTrend: [1, 2, 3, 2, 2, 3, 4]
  },
  {
    thought: normalizeThought({
      id: 'th-archive-sprint',
      title: 'Sprint 18 retrospective snapshot',
      content:
        'What worked: daily sync playback saved 45 mins per person. Next sprint: invest in search facets. Celebrate shipping daily review 1.0.',
      tags: ['retrospective', 'team', 'learning'],
      createdAt: iso('2025-09-20T17:05:00Z'),
      updatedAt: iso('2025-09-25T18:10:00Z')
    }),
    subtitle: 'Archive • 2 days ago',
    collection: 'archive',
    energy: 'low',
    momentum: 'parked',
    status: 'archive',
    activityTrend: [7, 6, 5, 4, 3, 2, 2]
  }
];
