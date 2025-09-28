import { useMemo } from 'react';
import type { Thought } from '@thoughtz/core';
import type { CollectionId } from '../workspaceData';
import { suggestionSeed } from './data';
import type { SuggestionPalette } from './data';

interface Args {
  query: string;
  activeCollection: CollectionId;
  activeThoughtId?: Thought['id'];
  activeTags: string[];
}

const MAX_SPOTLIGHTS = 4;
const MAX_CONTEXT_NODES = 5;

const intentPriority: Record<string, number> = {
  capture: 3,
  review: 2,
  link: 2,
  revive: 1
};

const scoreSuggestion = (suggestion: (typeof suggestionSeed)[number], { query, activeCollection, activeThoughtId, activeTags }: Args) => {
  let score = 0;

  if (suggestion.collection === activeCollection) {
    score += 3;
  }

  if (suggestion.targetThoughtId && suggestion.targetThoughtId === activeThoughtId) {
    score += 4;
  }

  if (activeTags.some((tag) => suggestion.tags.includes(tag))) {
    score += 2;
  }

  if (query.trim()) {
    const normalized = query.trim().toLowerCase();
    const matchesLabel = suggestion.label.toLowerCase().includes(normalized);
    const matchesContext = suggestion.context.toLowerCase().includes(normalized);
    const matchesSnippet = suggestion.snippet?.toLowerCase().includes(normalized) ?? false;
    if (matchesLabel || matchesContext || matchesSnippet) {
      score += 3;
    }
  }

  score += intentPriority[suggestion.intent] ?? 0;

  return score;
};

export const useSuggestionPalette = ({ query, activeCollection, activeThoughtId, activeTags }: Args): SuggestionPalette => {
  return useMemo(() => {
    const scored = suggestionSeed
      .map((suggestion) => ({
        suggestion,
        score: scoreSuggestion(suggestion, { query, activeCollection, activeThoughtId, activeTags })
      }))
      .filter(({ score }) => score > 0 || !query);

    const spotlights = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SPOTLIGHTS)
      .map(({ suggestion }) => ({
        id: suggestion.id,
        label: suggestion.label,
        context: suggestion.context,
        intent: suggestion.intent,
        snippet: suggestion.snippet,
        targetThoughtId: suggestion.targetThoughtId,
        collection: suggestion.collection
      }));

    const contextCandidates = scored
      .filter(({ suggestion }) => suggestion.collection === activeCollection && suggestion.targetThoughtId !== activeThoughtId)
      .slice(0, MAX_CONTEXT_NODES)
      .map(({ suggestion }) => ({
        id: suggestion.id,
        label: suggestion.label,
        context: suggestion.context,
        intent: suggestion.intent,
        snippet: suggestion.snippet,
        targetThoughtId: suggestion.targetThoughtId,
        collection: suggestion.collection
      }));

    return {
      spotlights,
      contextGroup: contextCandidates.length
        ? {
            id: `context-${activeCollection}`,
            heading: `More from ${activeCollection.replace('-', ' ')}`,
            nodes: contextCandidates
          }
        : undefined
    };
  }, [query, activeCollection, activeThoughtId, activeTags]);
};
