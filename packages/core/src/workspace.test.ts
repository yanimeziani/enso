import { describe, expect, it } from 'vitest';

import { workspaceEntryFromThought, toPersistableThought, makeSubtitle } from './workspace';
import { normalizeThought } from './thought';

describe('workspace metadata helpers', () => {
  it('strips workspace metadata tags when mapping to entries', () => {
    const thought = normalizeThought({
      id: 'th-test',
      title: 'Sample',
      content: 'Demo',
      tags: ['__enso:collection:projects', '__enso:status:now', '__enso:energy:high', '__enso:momentum:flow', 'focus'],
      createdAt: '2025-09-27T09:00:00Z',
      updatedAt: '2025-09-27T09:05:00Z'
    });

    const entry = workspaceEntryFromThought(thought);

    expect(entry.collection).toBe('projects');
    expect(entry.status).toBe('now');
    expect(entry.energy).toBe('high');
    expect(entry.momentum).toBe('flow');
    expect(entry.thought.tags).toEqual(['focus']);
    expect(entry.subtitle).toBe(makeSubtitle('projects', thought.updatedAt));
  });

  it('re-applies metadata tags when persisting entries', () => {
    const entry = workspaceEntryFromThought(
      normalizeThought({
        id: 'th-test-2',
        title: 'Another',
        content: 'Body',
        tags: ['__enso:collection:inbox', '__enso:status:inbox', '__enso:energy:medium', '__enso:momentum:steady', 'ideas'],
        createdAt: '2025-09-27T08:00:00Z',
        updatedAt: '2025-09-27T08:10:00Z'
      })
    );

    const persisted = toPersistableThought(entry);

    expect(persisted.tags).toContain('__enso:collection:inbox');
    expect(persisted.tags).toContain('__enso:status:inbox');
    expect(persisted.tags).toContain('ideas');
  });
});
