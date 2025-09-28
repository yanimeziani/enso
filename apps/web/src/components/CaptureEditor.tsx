import React from 'react';

import './CaptureEditor.css';

type SavingState = 'idle' | 'saving' | 'saved';

type CaptureEditorProps = {
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  savingState: SavingState;
  onChange: (patch: { title?: string; content?: string; tags?: string[] }) => void;
  tagOptions?: string[];
};

const formatUpdatedAt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const CaptureEditor: React.FC<CaptureEditorProps> = ({ title, content, tags, updatedAt, savingState, onChange, tagOptions = [] }) => {
  const [tagDraft, setTagDraft] = React.useState('');
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isSelecting, setIsSelecting] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const tagSuggestions = React.useMemo(() => {
    const query = tagDraft.trim().toLowerCase();
    const base = tagOptions.filter((option) => !tags.includes(option.toLowerCase()));
    if (!query) {
      return base.slice(0, 5);
    }
    return base.filter((option) => option.toLowerCase().startsWith(query)).slice(0, 5);
  }, [tagDraft, tagOptions, tags]);

  const handleSelectionState = React.useCallback(() => {
    const node = textareaRef.current;
    if (!node) {
      setIsSelecting(false);
      return;
    }
    setIsSelecting(node.selectionStart !== node.selectionEnd);
  }, []);

  const handleTagCommit = () => {
    const normalized = tagDraft.trim().toLowerCase();
    if (!normalized) return;
    if (tags.includes(normalized)) {
      setTagDraft('');
      return;
    }
    onChange({ tags: [...tags, normalized] });
    setTagDraft('');
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      handleTagCommit();
    }
    if (event.key === 'Backspace' && !tagDraft && tags.length) {
      onChange({ tags: tags.slice(0, -1) });
    }
  };

  const handleRemoveTag = (tag: string) => {
    onChange({ tags: tags.filter((value) => value !== tag) });
  };

  const handleTagSuggestionSelect = (suggestion: string) => {
    const normalized = suggestion.trim().toLowerCase();
    if (!normalized || tags.includes(normalized)) {
      setTagDraft('');
      return;
    }
    onChange({ tags: [...tags, normalized] });
    setTagDraft('');
  };

  const highlightedContent = React.useMemo(() => highlightContent(content), [content]);
  const toolbarVisible = isHovered || isFocused || isSelecting;
  const showSlashHint = /(^|\s)\/[\w-]*$/.test(content);
  const showMarkdownHint = content.trim().startsWith('#') || content.includes('`') || content.includes('*');

  const focusTextarea = React.useCallback((selectionStart?: number, selectionEnd?: number) => {
    window.requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) {
        return;
      }
      node.focus();
      if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
        node.setSelectionRange(selectionStart, selectionEnd);
      }
      handleSelectionState();
    });
  }, [handleSelectionState]);

  const applyFormatting = React.useCallback(
    (type: 'bold' | 'italic' | 'link') => {
      const node = textareaRef.current;
      if (!node) {
        return;
      }

      const value = node.value;
      const start = node.selectionStart ?? 0;
      const end = node.selectionEnd ?? 0;
      const selected = value.slice(start, end);

      const wrapWith = (marker: string, placeholder: string) => {
        const isWrapped =
          selected.length > 0 &&
          start >= marker.length &&
          value.slice(start - marker.length, start) === marker &&
          value.slice(end, end + marker.length) === marker;

        if (isWrapped) {
          const unwrappedStart = start - marker.length;
          const unwrappedEnd = end + marker.length;
          const next = value.slice(0, unwrappedStart) + selected + value.slice(unwrappedEnd);
          onChange({ content: next });
          focusTextarea(unwrappedStart, unwrappedStart + selected.length);
          return;
        }

        const insertion = selected || placeholder;
        const next = value.slice(0, start) + marker + insertion + marker + value.slice(end);
        const selectionStart = start + marker.length;
        const selectionEnd = selectionStart + insertion.length;
        onChange({ content: next });
        focusTextarea(selectionStart, selectionEnd);
      };

      if (type === 'bold') {
        wrapWith('**', 'bold text');
        return;
      }

      if (type === 'italic') {
        // avoid colliding with bold markers by checking neighbouring characters
        const before = value.slice(Math.max(0, start - 2), start);
        const after = value.slice(end, end + 2);
        const isPartOfBold = before === '**' || after === '**';
        if (isPartOfBold) {
          wrapWith('_', 'emphasis');
          return;
        }
        wrapWith('*', 'emphasis');
        return;
      }

      if (type === 'link') {
        const selection = value.slice(start, end);
        const existingMarkdown = selection.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (existingMarkdown) {
          const label = existingMarkdown[1];
          const next = value.slice(0, start) + label + value.slice(end);
          onChange({ content: next });
          focusTextarea(start, start + label.length);
          return;
        }

        let label = selection;
        if (!label) {
          const promptLabel = window.prompt('Link text');
          if (!promptLabel) {
            focusTextarea(start, end);
            return;
          }
          label = promptLabel.trim();
          if (!label) {
            focusTextarea(start, end);
            return;
          }
        }

        const defaultUrl = /^https?:\/\//i.test(selection) ? selection : 'https://';
        const urlInput = window.prompt('Link URL', defaultUrl);
        if (!urlInput) {
          focusTextarea(start, end);
          return;
        }
        const url = urlInput.trim();
        if (!url) {
          focusTextarea(start, end);
          return;
        }

        const markdown = `[${label}](${url})`;
        const next = value.slice(0, start) + markdown + value.slice(end);
        onChange({ content: next });
        focusTextarea(start + 1, start + 1 + label.length);
        return;
      }
    },
    [focusTextarea, onChange]
  );

  return (
    <div className="capture-editor">
      <input
        value={title}
        onChange={(event) => onChange({ title: event.target.value })}
        className="capture-editor__title"
        placeholder="Untitled thought"
        aria-label="Thought title"
      />

      <div className="capture-editor__tags">
        {tags.map((tag) => (
          <button key={tag} type="button" className="capture-editor__tag" onClick={() => handleRemoveTag(tag)}>
            #{tag}
          </button>
        ))}
        <input
          value={tagDraft}
          onChange={(event) => setTagDraft(event.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={handleTagCommit}
          className="capture-editor__tag-input"
          placeholder="Add #tag"
          aria-label="Add tag"
        />
        {tagSuggestions.length ? (
          <div className="capture-editor__tag-suggestions" role="listbox" aria-label="Tag suggestions">
            {tagSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                role="option"
                className="capture-editor__tag-suggestion"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleTagSuggestionSelect(suggestion)}
              >
                #{suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className={`capture-editor__surface${isFocused ? ' capture-editor__surface--focused' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`capture-editor__toolbar${toolbarVisible ? ' capture-editor__toolbar--visible' : ''}`} role="toolbar" aria-hidden={!toolbarVisible}>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Bold"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('bold')}
          >
            B
          </button>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Italic"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('italic')}
          >
            I
          </button>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Link"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('link')}
          >
            ↗
          </button>
        </div>
        <div className="capture-editor__ghost" aria-hidden="true">
          <pre className="capture-editor__ghost-text" dangerouslySetInnerHTML={{ __html: highlightedContent }} />
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => onChange({ content: event.target.value })}
          onFocus={() => {
            setIsFocused(true);
            handleSelectionState();
          }}
          onBlur={(event) => {
            setIsFocused(false);
            handleSelectionState();
            // ensure trailing newline persists visually
            if (!event.currentTarget.value) {
              setIsSelecting(false);
            }
          }}
          onSelect={handleSelectionState}
          onKeyUp={handleSelectionState}
          className="capture-editor__textarea"
          placeholder="Type your thought… add #tag, @project, or !focus when it helps."
          rows={16}
        />
        {showSlashHint || showMarkdownHint ? (
          <div className="capture-editor__ghost-overlay">
            <span className="capture-editor__ghost-hint">
              {showSlashHint ? 'Try / to open commands' : 'Markdown supported: **bold**, `code`, > quote'}
            </span>
          </div>
        ) : null}
        <button type="button" className="capture-editor__floating-add" aria-label="Add attachment or checklist" onClick={() => textareaRef.current?.focus()}>
          ＋
        </button>
      </div>

      <div className="capture-editor__status">
        <span>
          {savingState === 'saving' && 'Saving…'}
          {savingState === 'saved' && `Saved · ${formatUpdatedAt(updatedAt)}`}
          {savingState === 'idle' && `Updated ${formatUpdatedAt(updatedAt)}`}
        </span>
        <span className="capture-editor__hint">⌘ + Enter to mark as done</span>
      </div>
    </div>
  );
};

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const highlightContent = (raw: string) => {
  if (!raw) {
    return '<span class="capture-editor__ghost-placeholder">Type your thought…</span>';
  }

  let safe = escapeHtml(raw);

  safe = safe.replace(/\r/g, '');
  safe = safe.replace(/ {2}/g, ' &nbsp;');

  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<span class="capture-editor__strong">**$1**</span>');
  safe = safe.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (_match, prefix, body) => `${prefix}<span class="capture-editor__em">*${body}*</span>`);
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="capture-editor__link">[$1]($2)</span>');
  safe = safe.replace(/(^|\s)(#[\p{L}0-9_-]+)/giu, (_match, prefix, token) => `${prefix}<span class="capture-editor__token capture-editor__token--tag">${token}</span>`);
  safe = safe.replace(/(^|\s)(@[\p{L}0-9_-]+)/giu, (_match, prefix, token) => `${prefix}<span class="capture-editor__token capture-editor__token--mention">${token}</span>`);
  safe = safe.replace(/(!focus)/gi, '<span class="capture-editor__token capture-editor__token--focus">$1</span>');
  safe = safe.replace(/(https?:\/\/[^\s<]+)/gi, '<span class="capture-editor__link">$1</span>');
  safe = safe.replace(/`([^`]+)`/g, '<span class="capture-editor__inline-code">`$1`</span>');
  safe = safe.replace(/(^|\n)&gt;\s?(.*?)(?=\n|$)/g, (_match, prefix, body) => `${prefix}<span class="capture-editor__quote-line">&gt; ${body}</span>`);

  if (safe.endsWith('\n')) {
    safe += '&nbsp;';
  }

  return safe;
};
