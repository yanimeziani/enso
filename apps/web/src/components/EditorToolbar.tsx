import React from 'react';

import type { CollectionId } from '../workspaceData';
import './EditorToolbar.css';

type NavItem = {
  id: CollectionId;
  label: string;
  count: number;
};

type EditorToolbarProps = {
  navItems: NavItem[];
  activeCollection: CollectionId;
  onSelectCollection: (collection: CollectionId) => void;
  onOpenPalette: () => void;
  onOpenCaptureCenter: () => void;
  onTogglePreview: () => void;
  previewMode: 'overlay' | 'split';
  activeThoughtTitle?: string;
  activeThoughtUpdatedAt?: string;
};

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  navItems,
  activeCollection,
  onSelectCollection,
  onOpenPalette,
  onOpenCaptureCenter,
  onTogglePreview,
  previewMode,
  activeThoughtTitle,
  activeThoughtUpdatedAt
}) => {
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    if (!helpOpen) {
      return undefined;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest('.toolbar__help')) {
        return;
      }
      setHelpOpen(false);
    };

    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [helpOpen]);

  React.useEffect(() => {
    if (!helpOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelpOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [helpOpen]);

  return (
    <section className="toolbar" aria-label="Workspace navigation and tools">
      <div className="toolbar__collections">
        {navItems.map((item) => {
          const isActive = item.id === activeCollection;
          return (
            <button
              key={item.id}
              type="button"
              className={`toolbar__collection-button${isActive ? ' toolbar__collection-button--active' : ''}`}
              onClick={() => onSelectCollection(item.id)}
              aria-pressed={isActive}
              aria-label={`${item.label}${item.count ? ` (${item.count} items)` : ''}`}
            >
              <span>{item.label}</span>
              {item.count ? <span className="toolbar__collection-count">{item.count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="toolbar__context">
        {activeThoughtTitle ? (
          <div className="toolbar__current">
            <strong className="toolbar__current-title">{activeThoughtTitle}</strong>
            {activeThoughtUpdatedAt ? (
              <span className="toolbar__current-meta">Updated {activeThoughtUpdatedAt}</span>
            ) : null}
          </div>
        ) : (
          <span className="toolbar__current-meta">Select a thought to review.</span>
        )}
      </div>

      <div className="toolbar__actions">
        <button
          type="button"
          className="toolbar__button"
          onClick={onOpenPalette}
          aria-label="Open command palette"
          title="Open command palette (⌘ + K)"
        >
          <span className="toolbar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M8 11h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M8 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="toolbar__hint">⌘ K</span>
        </button>
        <button
          type="button"
          className={`toolbar__button${previewMode === 'split' ? ' toolbar__button--active' : ''}`}
          onClick={onTogglePreview}
          title={previewMode === 'split' ? 'Hide preview panel' : 'Show preview panel'}
          aria-label={previewMode === 'split' ? 'Hide preview panel' : 'Show preview panel'}
          aria-pressed={previewMode === 'split'}
        >
          <span className="toolbar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="5" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="13" y="5" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="13" y="14" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </span>
        </button>
        <button
          type="button"
          className="toolbar__button"
          onClick={onOpenCaptureCenter}
          title="Open capture center"
          aria-label="Open capture center"
        >
          <span className="toolbar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M9 10h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        <div className={`toolbar__help${helpOpen ? ' toolbar__help--open' : ''}`}>
          <button
            type="button"
            className="toolbar__button"
            onClick={() => setHelpOpen((current) => !current)}
            title="Markdown and shortcut help"
            aria-label="Markdown and shortcut help"
            aria-expanded={helpOpen}
          >
            <span className="toolbar__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M12 8a2.5 2.5 0 0 1 2.5 2.5c0 1.5-1.5 2-2 2.5-.4.4-.5.8-.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="17" r="1" fill="currentColor" />
              </svg>
            </span>
          </button>
          {helpOpen ? (
            <div className="toolbar__help-panel" role="dialog" aria-label="Markdown and shortcut help">
              <div className="toolbar__help-section">
                <strong>Markdown basics</strong>
                <ul>
                  <li># Heading, ## Section, ### Sub-section</li>
                  <li>* List item or 1. Numbered item</li>
                  <li>- [ ] Task list, `code`, ``` fences</li>
                  <li>[Link](url) and ![Alt](image)</li>
                </ul>
              </div>
              <div className="toolbar__help-section">
                <strong>Enso tokens</strong>
                <ul>
                  <li><span className="toolbar__help-token">#tag</span> Add taxonomy</li>
                  <li><span className="toolbar__help-token">@project</span> Route to a project</li>
                  <li><span className="toolbar__help-token">!focus</span> Prioritise now</li>
                </ul>
              </div>
              <div className="toolbar__help-section">
                <strong>Shortcuts</strong>
                <ul>
                  <li>⌘ + Enter marks done - ⌘ + K opens commands</li>
                  <li>/ focuses search - Esc closes panels</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default EditorToolbar;
