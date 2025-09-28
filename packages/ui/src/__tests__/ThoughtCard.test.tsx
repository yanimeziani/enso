import { render, screen } from '@testing-library/react';
import React from 'react';
import { normalizeThought } from '@thoughtz/core';
import { describe, expect, it, vi } from 'vitest';
import { ThoughtCard } from '../ThoughtCard';

describe('ThoughtCard', () => {
  it('renders a thought with tags and metadata', () => {
    const thought = normalizeThought({
      id: 'demo-1',
      title: 'Quick Capture',
      content: 'Sketch the daily review flow',
      tags: ['daily', 'review']
    });

    render(<ThoughtCard thought={thought} />);

    expect(screen.getByRole('heading', { name: /quick capture/i })).toBeInTheDocument();
    expect(screen.getByText(/Sketch the daily review flow/)).toBeInTheDocument();
    expect(screen.getByText('#daily')).toBeInTheDocument();
  });

  it('invokes the selection handler when clicked', () => {
    const thought = normalizeThought({
      id: 'demo-2',
      title: 'Offline sync',
      content: 'Design optimistic updates for note edits.'
    });
    const onSelect = vi.fn();

    render(<ThoughtCard thought={thought} onSelect={onSelect} />);

    screen.getByRole('button').click();

    expect(onSelect).toHaveBeenCalledWith('demo-2');
  });
});
