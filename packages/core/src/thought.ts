import { z } from 'zod';

export type ThoughtId = string;
export type IsoDateTimeString = string;

const TagSchema = z
  .string()
  .trim()
  .min(1, 'tags must not be empty')
  .max(32, 'tags should stay concise')
  .transform((tag) => tag.toLowerCase());

const ThoughtDraftSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).default('Untitled Thought'),
  content: z.string().trim().min(1, 'content must not be empty'),
  tags: z.array(TagSchema).default([]),
  links: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

const ThoughtSchema = ThoughtDraftSchema.extend({
  id: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).superRefine((value, ctx) => {
  if (new Set(value.links).has(value.id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'thought cannot link to itself',
      path: ['links']
    });
  }
});

const ThoughtUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1).optional(),
    tags: z.array(TagSchema).optional(),
    links: z.array(z.string().trim().min(1)).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'update requires at least one field'
  });

export type ThoughtDraft = z.input<typeof ThoughtDraftSchema>;
export type Thought = z.infer<typeof ThoughtSchema>;
export type ThoughtUpdate = z.input<typeof ThoughtUpdateSchema>;

const dedupe = <T>(items: T[]) => Array.from(new Set(items));

const generateId = (): ThoughtId => {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `th_${random}${stamp}`;
};

const nowIso = () => new Date().toISOString();

export const normalizeThought = (input: Thought | ThoughtDraft): Thought => {
  const parsed = ThoughtDraftSchema.parse(input);
  const createdAt = parsed.createdAt ?? nowIso();
  const updatedAt = parsed.updatedAt ?? createdAt;

  const thought: Thought = {
    id: parsed.id ?? generateId(),
    title: parsed.title,
    content: parsed.content,
    tags: dedupe(parsed.tags),
    links: dedupe(parsed.links.filter((link) => link !== parsed.id)),
    createdAt,
    updatedAt
  };

  return ThoughtSchema.parse(thought);
};

export const applyThoughtUpdate = (thought: Thought, patch: ThoughtUpdate): Thought => {
  const { title, content, tags, links } = ThoughtUpdateSchema.parse(patch);
  const next: Thought = {
    ...thought,
    title: title ?? thought.title,
    content: content ?? thought.content,
    tags: tags ? dedupe(tags) : thought.tags,
    links: links ? dedupe(links.filter((link) => link !== thought.id)) : thought.links,
    updatedAt: nowIso()
  };

  return ThoughtSchema.parse(next);
};

export const validateThought = (input: unknown): Thought => ThoughtSchema.parse(input);

export const isTagIncluded = (thought: Thought, tag: string): boolean => {
  const normalized = tag.trim().toLowerCase();
  return thought.tags.includes(normalized);
};

export const matchesQuery = (thought: Thought, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    thought.title.toLowerCase().includes(normalized) ||
    thought.content.toLowerCase().includes(normalized) ||
    thought.tags.some((tag) => tag.includes(normalized))
  );
};
