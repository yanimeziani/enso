import React from 'react';
import type { WorkspaceEntry } from '../workspaceData';

import './FlowList.css';

const Sparkline: React.FC<{ points?: number[] }> = ({ points }) => {
  if (!points || points.length < 2) {
    return null;
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const normalized = points.map((value, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  });

  return (
    <svg className="flow-list__sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Activity trend">
      <polyline points={normalized.join(' ')} />
    </svg>
  );
};

type FlowListProps = {
  title: string;
  description?: string;
  entries: WorkspaceEntry[];
  emptyCopy: React.ReactNode;
  onSelect: (id: string) => void;
  onAction: (id: string, action: 'done' | 'focus' | 'archive') => void;
  activeId?: string;
  showAdvanced?: boolean;
  enableDrag?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  droppable?: boolean;
  onDrop?: (id: string | null) => void;
  onDragEnterList?: () => void;
  onDragLeaveList?: () => void;
  isDropTarget?: boolean;
  onSwipeAction?: (id: string, action: 'focus' | 'archive') => void;
  highlightId?: string;
};

export const FlowList: React.FC<FlowListProps> = ({
  title,
  description,
  entries,
  emptyCopy,
  onSelect,
  onAction,
  activeId,
  showAdvanced = false,
  enableDrag = false,
  onDragStart,
  onDragEnd,
  droppable = false,
  onDrop,
  onDragEnterList,
  onDragLeaveList,
  isDropTarget = false,
  onSwipeAction,
  highlightId
}) => {
  const headingId = React.useId();
  const descriptionId = description ? `${headingId}-description` : undefined;
  const countLabel = `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`;

  return (
    <section
      className={`flow-list${droppable ? ' flow-list--droppable' : ''}${isDropTarget ? ' flow-list--droppable-active' : ''}`}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onDragOver={(event) => {
        if (!droppable) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={droppable ? () => onDragEnterList?.() : undefined}
      onDragLeave={droppable ? () => onDragLeaveList?.() : undefined}
      onDrop={(event) => {
        if (!droppable) {
          return;
        }
        event.preventDefault();
        const droppedId = event.dataTransfer.getData('text/plain');
        onDrop?.(droppedId || null);
      }}
    >
      <header className="flow-list__header">
        <div className="flow-list__heading">
          <h2 id={headingId}>{title}</h2>
          <span className="flow-list__count">{countLabel}</span>
        </div>
        {description ? (
          <span id={descriptionId} className="flow-list__description">
            {description}
          </span>
        ) : null}
      </header>

      {entries.length === 0 ? (
        <div className="flow-list__empty">
          <div className="flow-list__empty-content">{emptyCopy}</div>
        </div>
      ) : (
        <ul className="flow-list__items" aria-label={`${title} items`}>
          {entries.map((entry) => {
            const isActive = entry.thought.id === activeId;
            const isRecent = highlightId === entry.thought.id;
            const snippet = entry.thought.content.trim() || 'Draft';
            return (
              <li
                key={entry.thought.id}
                className={`flow-list__item${isActive ? ' flow-list__item--active' : ''}${isRecent ? ' flow-list__item--recent' : ''}`}
              draggable={enableDrag}
              onDragStart={(event) => {
                if (!enableDrag) {
                  return;
                }
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entry.thought.id);
                onDragStart?.(entry.thought.id);
              }}
              onDragEnd={() => {
                if (!enableDrag) {
                  return;
                }
                onDragEnd?.();
              }}
              onTouchStart={(event) => {
                if (!onSwipeAction) {
                  return;
                }
                const touch = event.touches[0];
                (event.currentTarget as HTMLElement).dataset.touchStartX = String(touch.clientX);
                (event.currentTarget as HTMLElement).dataset.touchStartY = String(touch.clientY);
                (event.currentTarget as HTMLElement).dataset.touchStartTime = String(Date.now());
              }}
              onTouchEnd={(event) => {
                if (!onSwipeAction) {
                  return;
                }
                const target = event.currentTarget as HTMLElement;
                const startX = Number(target.dataset.touchStartX ?? Number.NaN);
                const startY = Number(target.dataset.touchStartY ?? Number.NaN);
                const startTime = Number(target.dataset.touchStartTime ?? Number.NaN);
                const touch = event.changedTouches[0];
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                const elapsed = Date.now() - startTime;
                delete target.dataset.touchStartX;
                delete target.dataset.touchStartY;
                delete target.dataset.touchStartTime;

                if (Number.isNaN(startX) || Number.isNaN(startY)) {
                  return;
                }

                if (Math.abs(dy) > 40 || elapsed > 500) {
                  return;
                }

                if (dx > 60) {
                  onSwipeAction(entry.thought.id, 'focus');
                } else if (dx < -60) {
                  onSwipeAction(entry.thought.id, 'archive');
                }
              }}
            >
              <button
                type="button"
                className="flow-list__content"
                onClick={() => onSelect(entry.thought.id)}
                aria-current={isActive ? 'true' : undefined}
                title={entry.thought.title ? `Open ${entry.thought.title}` : 'Open untitled thought'}
              >
                <span className="flow-list__title">{entry.thought.title || 'Untitled thought'}</span>
                <span className="flow-list__snippet">{snippet}</span>
                <div className="flow-list__meta">
                  <span className="flow-list__subtitle">{entry.subtitle}</span>
                  {showAdvanced ? <Sparkline points={entry.activityTrend} /> : null}
                </div>
              </button>
              {showAdvanced ? (
                <div className="flow-list__actions" role="group" aria-label="Thought quick actions">
                  <button
                    className="flow-list__action flow-list__action--done"
                    type="button"
                    onClick={() => onAction(entry.thought.id, 'done')}
                    aria-label="Mark done"
                  />
                  <button
                    className="flow-list__action flow-list__action--focus"
                    type="button"
                    onClick={() => onAction(entry.thought.id, 'focus')}
                    aria-label="Move to Now"
                  />
                  <button
                    className="flow-list__action flow-list__action--archive"
                    type="button"
                    onClick={() => onAction(entry.thought.id, 'archive')}
                    aria-label="Archive thought"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
        </ul>
      )}
    </section>
  );
};
