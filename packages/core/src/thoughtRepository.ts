import { applyThoughtUpdate, matchesQuery, normalizeThought } from './thought';
import type { Thought, ThoughtDraft, ThoughtId, ThoughtUpdate } from './thought';

export interface ThoughtRepository {
  create(draft: ThoughtDraft): Promise<Thought>;
  update(id: ThoughtId, patch: ThoughtUpdate): Promise<Thought>;
  get(id: ThoughtId): Promise<Thought | null>;
  list(): Promise<Thought[]>;
  search(query: string): Promise<Thought[]>;
  link(source: ThoughtId, target: ThoughtId): Promise<Thought>;
  unlink(source: ThoughtId, target: ThoughtId): Promise<Thought>;
  remove(id: ThoughtId): Promise<void>;
}

export class InMemoryThoughtRepository implements ThoughtRepository {
  private readonly thoughts = new Map<ThoughtId, Thought>();

  async create(draft: ThoughtDraft): Promise<Thought> {
    const thought = normalizeThought(draft);
    this.thoughts.set(thought.id, thought);
    return thought;
  }

  async update(id: ThoughtId, patch: ThoughtUpdate): Promise<Thought> {
    const existing = this.thoughts.get(id);
    if (!existing) {
      throw new Error(`Thought ${id} not found`);
    }

    const updated = applyThoughtUpdate(existing, patch);
    this.thoughts.set(updated.id, updated);
    return updated;
  }

  async get(id: ThoughtId): Promise<Thought | null> {
    return this.thoughts.get(id) ?? null;
  }

  async list(): Promise<Thought[]> {
    return Array.from(this.thoughts.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async search(query: string): Promise<Thought[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.list();
    }

    return (await this.list()).filter((thought) => matchesQuery(thought, normalized));
  }

  async link(source: ThoughtId, target: ThoughtId): Promise<Thought> {
    if (source === target) {
      throw new Error('Cannot link a thought to itself.');
    }

    const origin = this.thoughts.get(source);
    const destination = this.thoughts.get(target);

    if (!origin) {
      throw new Error(`Source thought ${source} not found.`);
    }

    if (!destination) {
      throw new Error(`Target thought ${target} not found.`);
    }

    const updated = await this.update(origin.id, {
      links: origin.links.includes(target) ? origin.links : [...origin.links, target]
    });

    return updated;
  }

  async unlink(source: ThoughtId, target: ThoughtId): Promise<Thought> {
    const origin = this.thoughts.get(source);
    if (!origin) {
      throw new Error(`Source thought ${source} not found.`);
    }

    if (!origin.links.includes(target)) {
      return origin;
    }

    return this.update(source, {
      links: origin.links.filter((link: ThoughtId) => link !== target)
    });
  }

  async remove(id: ThoughtId): Promise<void> {
    this.thoughts.delete(id);

    const remaining = Array.from(this.thoughts.values());
    const updates: Array<Promise<Thought>> = [];

    for (const thought of remaining) {
      if (thought.links.includes(id)) {
        updates.push(
          this.update(thought.id, {
            links: thought.links.filter((link: ThoughtId) => link !== id)
          })
        );
      }
    }

    if (updates.length) {
      await Promise.all(updates);
    }
  }
}
