import React from 'react';
import type { WorkspaceEntry } from '../workspaceData';

import './NoteList.css';

type NoteListProps = {
  entries: WorkspaceEntry[];
  activeId: string;
  onSelect: (id: string) => void;
};

const formatRelativeTime = (iso: string) => {
  const updated = new Date(iso).getTime();
  const now = Date.now();
  const diffMinutes = Math.round((now - updated) / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(iso).toLocaleDateString();
};

export const NoteList: React.FC<NoteListProps> = ({ entries, activeId, onSelect }) => {
  if (!entries.length) {
    return (
      <div className="note-list__empty">
        <strong>No thoughts captured yet</strong>
        <span>Start a new note to begin organising.</span>
      </div>
    );
  }

  return (
    <div className="note-list" role="listbox" aria-label="Thoughts">
      {entries.map((entry) => {
        const isActive = entry.thought.id === activeId;
        return (
          <button
            type="button"
            key={entry.thought.id}
            className={`note-list__item${isActive ? ' note-list__item--active' : ''}`}
            onClick={() => onSelect(entry.thought.id)}
            aria-selected={isActive}
          >
            <div className="note-list__header">
              <span className="note-list__title">{entry.thought.title || 'Untitled thought'}</span>
              <span className="note-list__time">{formatRelativeTime(entry.thought.updatedAt)}</span>
            </div>
            <p className="note-list__preview">{entry.thought.content || 'Draft note'}</p>
            <div className="note-list__tags">
              {entry.thought.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="note-list__tag">
                  #{tag}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};
