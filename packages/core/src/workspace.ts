import { normalizeThought } from './thought';
import type { Thought, ThoughtDraft } from './thought';

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

type WorkspaceMetadata = Pick<WorkspaceEntry, 'collection' | 'status' | 'energy' | 'momentum'>;

const iso = (input: string) => new Date(input).toISOString();

const META_PREFIX = '__enso:';
const COLLECTION_TAG = `${META_PREFIX}collection:`;
const STATUS_TAG = `${META_PREFIX}status:`;
const ENERGY_TAG = `${META_PREFIX}energy:`;
const MOMENTUM_TAG = `${META_PREFIX}momentum:`;

const DEFAULT_METADATA: WorkspaceMetadata = {
  collection: 'inbox',
  status: 'inbox',
  energy: 'medium',
  momentum: 'steady'
};

const isCollectionId = (value: string): value is CollectionId =>
  value === 'inbox' || value === 'daily-review' || value === 'projects' || value === 'archive';

const isWorkspaceStatus = (value: string): value is WorkspaceStatus =>
  value === 'now' || value === 'inbox' || value === 'snoozed' || value === 'archive';

const isEnergy = (value: string): value is WorkspaceEntry['energy'] =>
  value === 'high' || value === 'medium' || value === 'low';

const isMomentum = (value: string): value is WorkspaceEntry['momentum'] =>
  value === 'flow' || value === 'steady' || value === 'parked';

export const collectionMeta: Record<CollectionId, { label: string; hint: string }> = {
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

const formatRelativeDate = (isoDate: string): string => {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return 'moments ago';
  }

  const diff = Date.now() - timestamp;
  if (diff < 45_000) {
    return 'just now';
  }
  if (diff < 90_000) {
    return '1 minute ago';
  }
  const minutes = Math.round(diff / 60_000);
  if (diff < 45 * 60_000) {
    return `${minutes} minutes ago`;
  }
  if (diff < 90 * 60_000) {
    return '1 hour ago';
  }
  const hours = Math.round(diff / 3_600_000);
  if (diff < 24 * 3_600_000) {
    return `${hours} hours ago`;
  }
  if (diff < 48 * 3_600_000) {
    return '1 day ago';
  }
  const days = Math.max(2, Math.round(diff / (24 * 3_600_000)));
  return `${days} days ago`;
};

export const makeSubtitle = (collection: CollectionId, updatedAt: string): string => {
  const label = collectionMeta[collection]?.label ?? 'Inbox';
  return `${label} • ${formatRelativeDate(updatedAt)}`;
};

const stripMetadataTags = (tags: string[]): { userTags: string[]; metadata: Partial<WorkspaceMetadata> } => {
  const metadata: Partial<WorkspaceMetadata> = {};
  const userTags: string[] = [];

  for (const tag of tags) {
    if (tag.startsWith(COLLECTION_TAG)) {
      const value = tag.slice(COLLECTION_TAG.length);
      if (isCollectionId(value)) {
        metadata.collection = value;
        continue;
      }
    }
    if (tag.startsWith(STATUS_TAG)) {
      const value = tag.slice(STATUS_TAG.length);
      if (isWorkspaceStatus(value)) {
        metadata.status = value;
        continue;
      }
    }
    if (tag.startsWith(ENERGY_TAG)) {
      const value = tag.slice(ENERGY_TAG.length);
      if (isEnergy(value)) {
        metadata.energy = value;
        continue;
      }
    }
    if (tag.startsWith(MOMENTUM_TAG)) {
      const value = tag.slice(MOMENTUM_TAG.length);
      if (isMomentum(value)) {
        metadata.momentum = value;
        continue;
      }
    }

    userTags.push(tag);
  }

  return { userTags, metadata };
};

const metadataToTags = (metadata: WorkspaceMetadata): string[] => [
  `${COLLECTION_TAG}${metadata.collection}`,
  `${STATUS_TAG}${metadata.status}`,
  `${ENERGY_TAG}${metadata.energy}`,
  `${MOMENTUM_TAG}${metadata.momentum}`
];

const ensureMetadata = (metadata: Partial<WorkspaceMetadata>): WorkspaceMetadata => ({
  ...DEFAULT_METADATA,
  ...metadata,
  status:
    metadata.status ?? (metadata.collection === 'archive' ? 'archive' : DEFAULT_METADATA.status)
});

export const workspaceEntryFromThought = (thought: Thought): WorkspaceEntry => {
  const { userTags, metadata } = stripMetadataTags(thought.tags);
  const completeMetadata = ensureMetadata(metadata);

  const publicThought: Thought = {
    ...thought,
    tags: userTags
  };

  return {
    thought: publicThought,
    subtitle: makeSubtitle(completeMetadata.collection, thought.updatedAt),
    collection: completeMetadata.collection,
    energy: completeMetadata.energy,
    momentum: completeMetadata.momentum,
    status: completeMetadata.status
  };
};

export const toPersistableThought = (entry: WorkspaceEntry): Thought => {
  const metadataTags = metadataToTags({
    collection: entry.collection,
    status: entry.status,
    energy: entry.energy,
    momentum: entry.momentum
  });

  return normalizeThought({
    ...entry.thought,
    tags: [...entry.thought.tags, ...metadataTags],
    createdAt: entry.thought.createdAt,
    updatedAt: entry.thought.updatedAt
  });
};

export const toPersistableDraft = (entry: WorkspaceEntry): ThoughtDraft => {
  const persisted = toPersistableThought(entry);
  return {
    id: persisted.id,
    title: persisted.title,
    content: persisted.content,
    tags: persisted.tags,
    links: persisted.links,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt
  };
};

const sampleThought = (data: {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}): Thought => normalizeThought(data);

const sampleEntry = (thought: Thought, overrides: Partial<WorkspaceEntry> = {}): WorkspaceEntry => {
  const entry = workspaceEntryFromThought(thought);
  return {
    ...entry,
    ...overrides,
    subtitle: makeSubtitle(entry.collection, thought.updatedAt)
  };
};

export const workspaceEntries: WorkspaceEntry[] = [
  sampleEntry(
    sampleThought({
      id: 'th-capture-ritual',
      title: 'Capture ritual: morning reset',
      content:
        'Three-breath pause before the day starts. Capture loose threads, triage into projects, and mark one focus outcome for the next 90 minutes.',
      tags: [
        `${COLLECTION_TAG}daily-review`,
        `${STATUS_TAG}now`,
        `${ENERGY_TAG}high`,
        `${MOMENTUM_TAG}flow`,
        'ritual',
        'morning',
        'focus'
      ],
      createdAt: iso('2025-09-27T07:25:00Z'),
      updatedAt: iso('2025-09-27T09:05:00Z')
    }),
    {
      activityTrend: [6, 9, 8, 12, 14, 16, 15]
    }
  ),
  sampleEntry(
    sampleThought({
      id: 'th-graph-connections',
      title: 'Graph layering for related thoughts',
      content:
        'Experiment with lightweight overlays that surface 3-hop relationships. Use sparklines to show how active a cluster was over the last week.',
      tags: [
        `${COLLECTION_TAG}projects`,
        `${STATUS_TAG}now`,
        `${ENERGY_TAG}medium`,
        `${MOMENTUM_TAG}steady`,
        'graph',
        'ui',
        'exploration'
      ],
      createdAt: iso('2025-09-24T16:10:00Z'),
      updatedAt: iso('2025-09-27T08:32:00Z')
    }),
    {
      activityTrend: [2, 4, 6, 4, 5, 7, 9]
    }
  ),
  sampleEntry(
    sampleThought({
      id: 'th-offline-handshake',
      title: 'Offline sync handshake notes',
      content:
        'Design a two-step handshake for offline edits: (1) capture diff bundle, (2) confirm merge with remote conflict agent. Log timeline for debugging.',
      tags: [
        `${COLLECTION_TAG}projects`,
        `${STATUS_TAG}now`,
        `${ENERGY_TAG}high`,
        `${MOMENTUM_TAG}flow`,
        'sync',
        'offline',
        'infra'
      ],
      createdAt: iso('2025-09-25T11:45:00Z'),
      updatedAt: iso('2025-09-27T08:05:00Z')
    }),
    {
      activityTrend: [1, 3, 5, 6, 8, 7, 10]
    }
  ),
  sampleEntry(
    sampleThought({
      id: 'th-tag-refresh',
      title: 'Tag taxonomy refresh',
      content:
        'Consolidate redundant tags ("workflow" vs "process"). Add guidance for energy-based tags: high-focus, low-friction, admin, creative.',
      tags: [
        `${COLLECTION_TAG}inbox`,
        `${STATUS_TAG}inbox`,
        `${ENERGY_TAG}medium`,
        `${MOMENTUM_TAG}steady`,
        'tags',
        'taxonomy',
        'cleanup'
      ],
      createdAt: iso('2025-09-26T14:22:00Z'),
      updatedAt: iso('2025-09-27T06:55:00Z')
    }),
    {
      activityTrend: [3, 3, 2, 4, 5, 4, 6]
    }
  ),
  sampleEntry(
    sampleThought({
      id: 'th-voice-capture',
      title: 'Voice capture spike learnings',
      content:
        'Latency acceptable under 250ms on-device. Need a fallback text prompt when speech fails. Consider automatic summarization for long captures.',
      tags: [
        `${COLLECTION_TAG}inbox`,
        `${STATUS_TAG}inbox`,
        `${ENERGY_TAG}low`,
        `${MOMENTUM_TAG}steady`,
        'voice',
        'capture',
        'mobile'
      ],
      createdAt: iso('2025-09-23T10:18:00Z'),
      updatedAt: iso('2025-09-27T05:40:00Z')
    }),
    {
      activityTrend: [1, 2, 3, 2, 2, 3, 4]
    }
  ),
  sampleEntry(
    sampleThought({
      id: 'th-archive-sprint',
      title: 'Sprint 18 retrospective snapshot',
      content:
        'What worked: daily sync playback saved 45 mins per person. Next sprint: invest in search facets. Celebrate shipping daily review 1.0.',
      tags: [
        `${COLLECTION_TAG}archive`,
        `${STATUS_TAG}archive`,
        `${ENERGY_TAG}low`,
        `${MOMENTUM_TAG}parked`,
        'retrospective',
        'team',
        'learning'
      ],
      createdAt: iso('2025-09-20T17:05:00Z'),
      updatedAt: iso('2025-09-25T18:10:00Z')
    }),
    {
      activityTrend: [7, 6, 5, 4, 3, 2, 2]
    }
  )
];

export const stripWorkspaceMetadata = (thought: Thought): Thought => {
  const { userTags } = stripMetadataTags(thought.tags);
  return {
    ...thought,
    tags: userTags
  };
};

export const mergeMetadata = (thought: Thought, metadata: WorkspaceMetadata): Thought => {
  return normalizeThought({
    ...thought,
    tags: [...thought.tags, ...metadataToTags(metadata)],
    createdAt: thought.createdAt,
    updatedAt: thought.updatedAt
  });
};

export const metadataFromThought = (thought: Thought): WorkspaceMetadata => {
  const { metadata } = stripMetadataTags(thought.tags);
  return ensureMetadata(metadata);
};
