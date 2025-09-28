import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryThoughtRepository } from '../thoughtRepository';

const repository = new InMemoryThoughtRepository();

describe('InMemoryThoughtRepository', () => {
  beforeEach(async () => {
    const thoughts = await repository.list();
    await Promise.all(thoughts.map((thought) => repository.remove(thought.id)));
  });

  it('creates and retrieves a thought', async () => {
    const created = await repository.create({
      title: 'Quick capture',
      content: 'Note the offline sync design constraints',
      tags: ['offline']
    });

    const fetched = await repository.get(created.id);
    expect(fetched).toStrictEqual(created);
  });

  it('searches thoughts by partial text and tags', async () => {
    await repository.create({ title: 'Lynx bridge', content: 'Connect native modules', tags: ['mobile'] });
    await repository.create({ title: 'Offline queue', content: 'Store mutations until connectivity', tags: ['offline'] });

    const matches = await repository.search('offline');
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe('Offline queue');
  });

  it('links and unlinks thoughts', async () => {
    const parent = await repository.create({ title: 'Parent', content: 'parent content' });
    const child = await repository.create({ title: 'Child', content: 'child content' });

    const linked = await repository.link(parent.id, child.id);
    expect(linked.links).toContain(child.id);

    const unlinked = await repository.unlink(parent.id, child.id);
    expect(unlinked.links).not.toContain(child.id);
  });

  it('removes a thought and cleans up references', async () => {
    const a = await repository.create({ title: 'A', content: 'content A' });
    const b = await repository.create({ title: 'B', content: 'content B', links: [a.id] });

    await repository.remove(a.id);
    const orphan = await repository.get(a.id);
    expect(orphan).toBeNull();

    const updatedB = await repository.get(b.id);
    expect(updatedB?.links).not.toContain(a.id);
  });
});
