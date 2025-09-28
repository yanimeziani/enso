import { describe, expect, it } from 'vitest';
import { applyThoughtUpdate, normalizeThought } from '../thought';

describe('normalizeThought', () => {
  it('creates a thought with normalized tags and timestamps', () => {
    const thought = normalizeThought({
      title: 'Capture idea',
      content: 'Sketch the onboarding flow',
      tags: ['Product', 'product', 'Design'],
      links: []
    });

    expect(thought.id).toMatch(/^th_/);
    expect(thought.tags).toEqual(['product', 'design']);
    expect(thought.createdAt).toBeTruthy();
    expect(thought.updatedAt).toBeTruthy();
  });

  it('rejects a thought that links to itself', () => {
    expect(() =>
      normalizeThought({
        id: 'thought-1',
        title: 'Reflection',
        content: 'Meta thinking',
        links: ['thought-1']
      })
    ).toThrow(/thought cannot link to itself/);
  });
});

describe('applyThoughtUpdate', () => {
  it('updates mutable fields and refreshes updatedAt timestamp', () => {
    const original = normalizeThought({
      id: 't1',
      title: 'Original',
      content: 'Initial content'
    });

    const updated = applyThoughtUpdate(original, {
      content: 'Revised content',
      tags: ['alpha', 'beta']
    });

    expect(updated.content).toBe('Revised content');
    expect(updated.tags).toEqual(['alpha', 'beta']);
    expect(updated.updatedAt > original.updatedAt).toBe(true);
  });
});
