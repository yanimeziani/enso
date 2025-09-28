import type { ThoughtRepository } from './thoughtRepository';
import type { Thought, ThoughtDraft, ThoughtId, ThoughtUpdate } from './thought';
import { normalizeThought } from './thought';
import { resolveApiBaseUrl } from './runtimeEnv';

interface ServerThought {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface ServerThoughtDraft {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  links?: string[];
  created_at?: string;
  updated_at?: string;
}

interface ServerThoughtUpdate {
  title?: string;
  content?: string;
  tags?: string[];
  links?: string[];
  updated_at?: string;
}

class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const toClientThought = (payload: ServerThought): Thought =>
  normalizeThought({
    id: payload.id,
    title: payload.title,
    content: payload.content,
    tags: payload.tags,
    links: payload.links,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at
  });

const toIsoString = (value?: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value.toISOString() : value;
};

const toServerDraft = (draft: ThoughtDraft): ServerThoughtDraft => ({
  id: draft.id,
  title: draft.title ?? 'Untitled Thought',
  content: draft.content,
  tags: draft.tags ?? [],
  links: draft.links && draft.links.length ? draft.links : undefined,
  created_at: toIsoString(draft.createdAt),
  updated_at: toIsoString(draft.updatedAt)
});

const toServerUpdate = (patch: ThoughtUpdate): ServerThoughtUpdate => ({
  title: patch.title,
  content: patch.content,
  tags: patch.tags,
  links: patch.links,
  updated_at: toIsoString(patch.updatedAt)
});

const withJson = (init?: RequestInit): RequestInit => ({
  headers: {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {})
  },
  ...init
});

export class HttpThoughtRepository implements ThoughtRepository {
  private readonly baseUrl: string;

  constructor(baseUrl: string = resolveApiBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      const text = await response.text();
      throw new HttpError(text || `Request failed: ${response.status}`, response.status);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  async create(draft: ThoughtDraft): Promise<Thought> {
    const payload = toServerDraft(draft);
    const result = await this.request<ServerThought>('/thoughts/', withJson({
      method: 'POST',
      body: JSON.stringify(payload)
    }));
    return toClientThought(result);
  }

  async update(id: ThoughtId, patch: ThoughtUpdate): Promise<Thought> {
    const payload = toServerUpdate(patch);
    const result = await this.request<ServerThought>(`/thoughts/${id}`, withJson({
      method: 'PATCH',
      body: JSON.stringify(payload)
    }));
    return toClientThought(result);
  }

  async get(id: ThoughtId): Promise<Thought | null> {
    try {
      const result = await this.request<ServerThought>(`/thoughts/${id}`, { method: 'GET' });
      return toClientThought(result);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async list(): Promise<Thought[]> {
    const result = await this.request<ServerThought[]>('/thoughts/', { method: 'GET' });
    return result.map(toClientThought);
  }

  async search(query: string): Promise<Thought[]> {
    const params = new URLSearchParams({ search: query });
    const result = await this.request<ServerThought[]>(`/thoughts/?${params.toString()}`, {
      method: 'GET'
    });
    return result.map(toClientThought);
  }

  async link(source: ThoughtId, target: ThoughtId): Promise<Thought> {
    const result = await this.request<ServerThought>(`/thoughts/${source}/links/${target}`, { method: 'POST' });
    return toClientThought(result);
  }

  async unlink(source: ThoughtId, target: ThoughtId): Promise<Thought> {
    const result = await this.request<ServerThought>(`/thoughts/${source}/links/${target}`, { method: 'DELETE' });
    return toClientThought(result);
  }

  async remove(id: ThoughtId): Promise<void> {
    await this.request(`/thoughts/${id}`, { method: 'DELETE' });
  }
}

export default HttpThoughtRepository;
