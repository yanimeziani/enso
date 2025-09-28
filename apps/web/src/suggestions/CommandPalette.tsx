import React, { useEffect, useRef } from 'react';
import type { SuggestionPalette, SuggestionNode } from './data';

import './CommandPalette.css';

type CommandPaletteProps = {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  palette: SuggestionPalette;
  highlightIndex: number;
  onHover: (index: number) => void;
  onSelect: (node: SuggestionNode) => void;
  onClose: () => void;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  query,
  onQueryChange,
  palette,
  highlightIndex,
  onHover,
  onSelect,
  onClose
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const flatNodes = [...palette.spotlights, ...(palette.contextGroup?.nodes ?? [])];

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!open) return;

      const total = flatNodes.length;
      if (!total) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = (highlightIndex + 1) % total;
        onHover(next);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const next = highlightIndex <= 0 ? total - 1 : highlightIndex - 1;
        onHover(next);
        return;
      }

      if (event.key === 'Enter' && highlightIndex >= 0 && flatNodes[highlightIndex]) {
        event.preventDefault();
        onSelect(flatNodes[highlightIndex]);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, flatNodes, highlightIndex, onHover, onSelect, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="command-palette" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="command-palette__surface" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search, capture, or run a command"
          className="command-palette__input"
          aria-label="Command palette"
        />

        <div className="command-palette__list">
          {flatNodes.length === 0 ? (
            <div className="command-palette__empty">No matches</div>
          ) : (
            flatNodes.map((node, index) => (
              <button
                key={node.id}
                type="button"
                className={`command-palette__item${index === highlightIndex ? ' command-palette__item--active' : ''}`}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(node)}
              >
                <div className="command-palette__label">{node.label}</div>
                <div className="command-palette__meta">
                  <span>{node.context}</span>
                  <span>{node.intent}</span>
                </div>
                {node.snippet ? <div className="command-palette__snippet">{node.snippet}</div> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
