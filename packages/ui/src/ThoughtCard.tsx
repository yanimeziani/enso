import type { Thought } from '@thoughtz/core';
import React from 'react';

import './ThoughtCard.css';

type ThoughtCardProps = {
  thought: Thought;
  onSelect?: (id: Thought['id']) => void;
  isActive?: boolean;
  subtitle?: string;
  className?: string;
};

const formatDate = (iso: string) => new Date(iso).toLocaleString();

export const ThoughtCard: React.FC<ThoughtCardProps> = ({ thought, onSelect, isActive = false, subtitle, className }) => {
  const handleSelect = () => {
    onSelect?.(thought.id);
  };

  const interactive = Boolean(onSelect);

  return (
    <article
      role={interactive ? 'button' : 'article'}
      tabIndex={interactive ? 0 : -1}
      onClick={interactive ? handleSelect : undefined}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSelect();
        }
      }}
      className={[
        'tz-thought-card',
        interactive ? 'tz-thought-card--interactive' : '',
        isActive ? 'tz-thought-card--active' : '',
        className ?? ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="tz-thought-card__header">
        <h2 className="tz-thought-card__title">{thought.title}</h2>
        <time className="tz-thought-card__meta" dateTime={thought.updatedAt}>
          Updated {formatDate(thought.updatedAt)}
        </time>
        {subtitle ? <span className="tz-thought-card__subtitle">{subtitle}</span> : null}
      </header>

      <p className="tz-thought-card__body">{thought.content}</p>

      {thought.tags.length > 0 && (
        <footer className="tz-thought-card__tags">
          {thought.tags.map((tag) => (
            <span key={tag} className="tz-thought-card__tag">
              #{tag}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
};
