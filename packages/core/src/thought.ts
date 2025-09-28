import { z } from 'zod';

export type ThoughtId = string;
export type IsoDateTimeString = string;

const DATE_TIME_PATTERN = /^([0-9]{4}-[0-9]{2}-[0-9]{2})[ T]([0-9]{2}:[0-9]{2}:[0-9]{2})(\.[0-9]+)?(Z|[+-][0-9]{2}:?[0-9]{2})?$/;

const toIsoDateTime = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const match = DATE_TIME_PATTERN.exec(trimmed);
  if (match) {
    const [, datePart, timePart, fractionPart = '', zonePart] = match;
    const fractional = fractionPart ? fractionPart.slice(1) : '';
    const milliseconds = fractional.padEnd(3, '0').slice(0, 3);
    let timezone = zonePart ?? 'Z';
    if (timezone !== 'Z' && !timezone.includes(':')) {
      timezone = `${timezone.slice(0, 3)}:${timezone.slice(3, 5)}`;
    }
    const candidate = `${datePart}T${timePart}.${milliseconds}${timezone}`;
    const parsed = Date.parse(candidate);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return new Date(parsed).toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const DateTimeStringSchema = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const normalized = toIsoDateTime(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid datetime'
      });
      return z.NEVER;
    }
    return normalized;
  });

const ContentSchema = z.string().refine((value) => value.trim().length > 0, {
  message: 'content must not be empty'
});

const TagSchema = z
  .string()
  .trim()
  .min(1, 'tags must not be empty')
  .max(32, 'tags should stay concise')
  .transform((tag) => tag.toLowerCase());

const ThoughtDraftSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).default('Untitled Thought'),
  content: ContentSchema,
  tags: z.array(TagSchema).default([]),
  links: z.array(z.string().trim().min(1)).default([]),
  createdAt: DateTimeStringSchema.optional(),
  updatedAt: DateTimeStringSchema.optional()
});

const ThoughtSchema = ThoughtDraftSchema.extend({
  id: z.string().trim().min(1),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema
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
    content: ContentSchema.optional(),
    tags: z.array(TagSchema).optional(),
    links: z.array(z.string().trim().min(1)).optional(),
    updatedAt: DateTimeStringSchema.optional()
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
    links: dedupe(parsed.links),
    createdAt,
    updatedAt
  };

  return ThoughtSchema.parse(thought);
};

export const applyThoughtUpdate = (thought: Thought, patch: ThoughtUpdate): Thought => {
  const { title, content, tags, links, updatedAt } = ThoughtUpdateSchema.parse(patch);
  const proposedUpdatedAt = updatedAt ?? nowIso();
  const ensuredUpdatedAt = proposedUpdatedAt > thought.updatedAt
    ? proposedUpdatedAt
    : new Date(Date.parse(thought.updatedAt) + 1).toISOString();

  const next: Thought = {
    ...thought,
    title: title ?? thought.title,
    content: content ?? thought.content,
    tags: tags ? dedupe(tags) : thought.tags,
    links: links ? dedupe(links) : thought.links,
    updatedAt: ensuredUpdatedAt
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
