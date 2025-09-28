import React, { useEffect, useMemo, useRef, useId } from 'react';
import type { SuggestionPalette, SuggestionNode } from './data';
import type { CollectionId } from '../workspaceData';
import { CaptureBox, type CaptureSuggestions } from '../components/CaptureBox';
import type { AIClientMode } from '@enso/core';

import './CommandPalette.css';

type CommandPaletteMode = 'suggestions' | 'capture';

type CaptureDefaults = {
  label: string;
  tags: string[];
  collection: CollectionId;
};

type CommandPaletteProps = {
  open: boolean;
  mode: CommandPaletteMode;
  query: string;
  onQueryChange: (value: string) => void;
  palette: SuggestionPalette;
  highlightIndex: number;
  onHover: (index: number) => void;
  onSelect: (node: SuggestionNode) => void;
  onClose: () => void;
  captureDefaults?: CaptureDefaults;
  onCaptureSubmit: (payload: { text: string; tags: string[]; focus: boolean; project?: string; collectionOverride?: CollectionId }) => void;
  onCaptureCancel: () => void;
  captureBoxConfig: {
    suggestions: CaptureSuggestions;
    placeholder: string;
    showCommandShortcuts: boolean;
    aiOptions?: {
      enabled: boolean;
      mode: AIClientMode;
      status: 'disabled' | 'checking' | 'ok' | 'unavailable';
      detail?: string | null;
    };
  };
  captureContext?: React.ReactNode;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  mode,
  query,
  onQueryChange,
  palette,
  highlightIndex,
  onHover,
  onSelect,
  onClose,
  captureDefaults,
  onCaptureSubmit,
  onCaptureCancel,
  captureBoxConfig,
  captureContext
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const flatNodes = mode === 'suggestions' ? [...palette.spotlights, ...(palette.contextGroup?.nodes ?? [])] : [];
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const listboxId = useId();
  const activeOptionId =
    mode === 'suggestions' && highlightIndex >= 0 && flatNodes[highlightIndex]
      ? `command-palette-item-${flatNodes[highlightIndex].id}`
      : undefined;
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (open && mode === 'suggestions') {
      inputRef.current?.focus();
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode === 'capture') {
      return;
    }

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
  }, [open, mode, flatNodes, highlightIndex, onHover, onSelect, onClose]);

  useEffect(() => {
    if (!open || mode !== 'capture') {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCaptureCancel();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, mode, onCaptureCancel]);

  const captureInitialValue = useMemo(() => {
    if (!captureDefaults) {
      return undefined;
    }
    const tokens: string[] = [];
    if (captureDefaults.tags?.length) {
      tokens.push(...captureDefaults.tags.map((tag) => `#${tag}`));
    }
    return tokens.length ? `${tokens.join(' ')} ` : undefined;
  }, [captureDefaults]);

  const captureLabel = captureDefaults?.label ?? 'Quick capture';
  const captureDescription = captureDefaults?.label
    ? 'Layer detail then press ⌘ + Enter to capture.'
    : 'One box. Drop the thought and route it later.';

  if (!open) {
    return null;
  }

  if (mode === 'capture') {
    const hasCaptureContext = Boolean(captureContext);
    const layoutClassName = hasCaptureContext
      ? 'command-palette__capture-layout'
      : 'command-palette__capture-layout command-palette__capture-layout--solo';
    return (
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={captureDescription ? dialogDescriptionId : undefined}
        onClick={onClose}
      >
        <div className="command-palette__surface command-palette__surface--capture" onClick={(event) => event.stopPropagation()}>
          <h2 className="visually-hidden" id={dialogTitleId}>
            {captureLabel}
          </h2>
          {captureDescription ? (
            <p className="visually-hidden" id={dialogDescriptionId}>
              {captureDescription}
            </p>
          ) : null}
          <div className={layoutClassName}>
            <CaptureBox
              onCapture={(payload) =>
                onCaptureSubmit({
                  ...payload,
                  collectionOverride: captureDefaults?.collection
                })
              }
              suggestions={captureBoxConfig.suggestions}
              onCommandPalette={onCaptureCancel}
              placeholder={captureBoxConfig.placeholder}
              isCollapsed={false}
              onCollapseToggle={() => {}}
              onDismiss={onCaptureCancel}
              showCommandShortcuts={captureBoxConfig.showCommandShortcuts}
              onCaptured={onClose}
              showHeader
              headerLabel={captureLabel}
              headerDescription={captureDescription}
              showCommandShortcutButton={false}
              showViewControls={false}
              className="command-palette__capture-box"
              initialValue={captureInitialValue}
              aiOptions={captureBoxConfig.aiOptions}
            />
            {hasCaptureContext ? <div className="command-palette__capture-context">{captureContext}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="command-palette"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
      onClick={onClose}
    >
      <div className="command-palette__surface" onClick={(event) => event.stopPropagation()}>
        <h2 className="visually-hidden" id={dialogTitleId}>
          Command palette
        </h2>
        <p className="visually-hidden" id={dialogDescriptionId}>
          Use arrow keys to navigate, press Enter to run a command.
        </p>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search, capture, or run a command"
          className="command-palette__input"
          aria-label="Command palette"
          aria-controls={listboxId}
          aria-describedby={dialogDescriptionId}
        />

        <div
          className="command-palette__list"
          role="listbox"
          id={listboxId}
          aria-activedescendant={activeOptionId}
        >
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
                id={`command-palette-item-${node.id}`}
                role="option"
                aria-selected={index === highlightIndex}
                tabIndex={-1}
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
