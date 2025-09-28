import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { visit } from 'unist-util-visit';
import type { Components } from 'react-markdown';
import type { Emphasis, InlineCode, Link, Root, Strong, Text } from 'mdast';

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
  previewMode?: 'overlay' | 'split';
};

const formatUpdatedAt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const joinClassNames = (...parts: Array<string | undefined | false>): string => parts.filter(Boolean).join(' ');

const TOKEN_PATTERN = /#[\p{L}0-9_-]+|@[\p{L}0-9_-]+|!(?:focus|deep|energy)/giu;

type MarkerData = {
  markerPrefix?: string;
  markerSuffix?: string;
};

type MarkdownCodeProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  node?: (InlineCode & { data?: MarkerData }) | null;
};

const remarkHighlightTokens = () => (tree: Root) => {
  visit(tree, 'text', (node, index, parent) => {
    if (!parent || !Array.isArray((parent as { children?: Text[] }).children)) {
      return;
    }

    const parentType = (parent as { type?: string }).type;
    if (parentType && ['link', 'linkReference', 'code', 'inlineCode'].includes(parentType)) {
      return;
    }

    const value = node.value;
    if (!value) {
      return;
    }

    const segments: Text[] = [];
    let lastIndex = 0;
    const pattern = new RegExp(TOKEN_PATTERN.source, TOKEN_PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
      const token = match[0];
      const matchIndex = match.index ?? 0;

      if (matchIndex > lastIndex) {
        segments.push({ type: 'text', value: value.slice(lastIndex, matchIndex) });
      }

      const classNames = ['capture-editor__token'];
      if (token.startsWith('#')) {
        classNames.push('capture-editor__token--tag');
      } else if (token.startsWith('@')) {
        classNames.push('capture-editor__token--mention');
      } else {
        classNames.push('capture-editor__token--focus');
      }

      segments.push({
        type: 'text',
        value: token,
        data: {
          hName: 'span',
          hProperties: {
            className: classNames
          }
        }
      } as Text);

      lastIndex = matchIndex + token.length;
    }

    if (!segments.length) {
      return;
    }

    if (lastIndex < value.length) {
      segments.push({ type: 'text', value: value.slice(lastIndex) });
    }

    if (typeof index !== 'number') {
      return;
    }

    (parent.children as Text[]).splice(index, 1, ...segments);
    return index + segments.length;
  });
};

const detectEdgeMarker = (snippet: string, minimum: number) => {
  if (!snippet || snippet.length < minimum * 2) {
    return null;
  }

  const startChar = snippet[0];
  const endChar = snippet[snippet.length - 1];
  if (startChar !== endChar) {
    return null;
  }

  let prefixLength = 0;
  while (prefixLength < snippet.length && snippet[prefixLength] === startChar) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (suffixLength < snippet.length && snippet[snippet.length - 1 - suffixLength] === endChar) {
    suffixLength += 1;
  }

  if (prefixLength < minimum || suffixLength < minimum) {
    return null;
  }

  return {
    prefix: snippet.slice(0, prefixLength),
    suffix: snippet.slice(snippet.length - suffixLength)
  };
};

const remarkPreserveFormattingMarkers = () => (tree: Root, file: unknown) => {
  const source = String(file ?? '');

  visit(tree, (node) => {
    const position = node.position;
    if (!position || position.start.offset == null || position.end.offset == null) {
      return;
    }

    const snippet = source.slice(position.start.offset, position.end.offset);
    if (!snippet) {
      return;
    }

    if (node.type === 'strong') {
      const edges = detectEdgeMarker(snippet, 2);
      if (edges) {
        const data = ((node as Strong).data ??= {}) as MarkerData;
        data.markerPrefix = edges.prefix;
        data.markerSuffix = edges.suffix;
      }
    }

    if (node.type === 'emphasis') {
      const edges = detectEdgeMarker(snippet, 1);
      if (edges) {
        const data = ((node as Emphasis).data ??= {}) as MarkerData;
        data.markerPrefix = edges.prefix;
        data.markerSuffix = edges.suffix;
      }
    }

    if (node.type === 'inlineCode') {
      const leading = snippet.match(/^`+/)?.[0] ?? '`';
      const trailing = snippet.match(/`+$/)?.[0] ?? '`';
      const data = ((node as InlineCode).data ??= {}) as MarkerData;
      data.markerPrefix = leading;
      data.markerSuffix = trailing;
    }

    if (node.type === 'link') {
      const linkNode = node as Link;
      const suffix = `](${linkNode.url ?? ''}${linkNode.title ? ` "${linkNode.title}"` : ''})`;
      const data = (linkNode.data ??= {}) as MarkerData;
      data.markerPrefix = '[';
      data.markerSuffix = suffix;
    }
  });
};

const markdownComponents: Components = {
  p({ className, ...props }) {
    return <p className={joinClassNames('capture-editor__preview-paragraph', className)} {...props} />;
  },
  strong({ node, className, children, ...props }) {
    const data = (node?.data ?? {}) as MarkerData;
    return (
      <strong
        className={joinClassNames('capture-editor__strong capture-editor__marker-run', className)}
        data-marker-prefix={data.markerPrefix ?? '**'}
        data-marker-suffix={data.markerSuffix ?? '**'}
        {...props}
      >
        {children}
      </strong>
    );
  },
  em({ node, className, children, ...props }) {
    const data = (node?.data ?? {}) as MarkerData;
    return (
      <em
        className={joinClassNames('capture-editor__em capture-editor__marker-run', className)}
        data-marker-prefix={data.markerPrefix ?? '*'}
        data-marker-suffix={data.markerSuffix ?? '*'}
        {...props}
      >
        {children}
      </em>
    );
  },
  code(codeProps) {
    const { inline, node, className, children, ...props } = codeProps as MarkdownCodeProps;

    if (inline) {
      const data = (node?.data ?? {}) as MarkerData;
      return (
        <code
          className={joinClassNames('capture-editor__inline-code capture-editor__marker-run', className)}
          data-marker-prefix={data.markerPrefix ?? '`'}
          data-marker-suffix={data.markerSuffix ?? '`'}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className={joinClassNames('capture-editor__code-block', className)}>
        <code {...props}>{children}</code>
      </pre>
    );
  },
  blockquote({ className, ...props }) {
    return <blockquote className={joinClassNames('capture-editor__blockquote', className)} {...props} />;
  },
  a({ node, className, children, ...props }) {
    const data = (node?.data ?? {}) as MarkerData;
    return (
      <a
        className={joinClassNames('capture-editor__link capture-editor__marker-run', className)}
        data-marker-prefix={data.markerPrefix ?? '['}
        data-marker-suffix={data.markerSuffix ?? ']'}
        {...props}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  ul({ className, ...props }) {
    return <ul className={joinClassNames('capture-editor__preview-list', className)} {...props} />;
  },
  ol({ className, ...props }) {
    return <ol className={joinClassNames('capture-editor__preview-list', className)} {...props} />;
  },
  li({ className, ...props }) {
    return <li className={joinClassNames('capture-editor__preview-list-item', className)} {...props} />;
  },
  hr({ className, ...props }) {
    return <hr className={joinClassNames('capture-editor__preview-divider', className)} {...props} />;
  }
};

export const CaptureEditor: React.FC<CaptureEditorProps> = ({
  title,
  content,
  tags,
  updatedAt,
  savingState,
  onChange,
  tagOptions = [],
  previewMode = 'overlay'
}) => {
  const [tagDraft, setTagDraft] = React.useState('');
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isSelecting, setIsSelecting] = React.useState(false);
  const [caretIndex, setCaretIndex] = React.useState(() => content.length);
  const [scrollTop, setScrollTop] = React.useState(0);
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
      setCaretIndex(0);
      setScrollTop(0);
      return;
    }

    const start = node.selectionStart ?? 0;
    const end = node.selectionEnd ?? 0;

    setIsSelecting(start !== end);
    setCaretIndex((current) => (current === start ? current : start));
    setScrollTop((current) => (current === node.scrollTop ? current : node.scrollTop));
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

  React.useEffect(() => {
    const nextLength = content.length;
    setCaretIndex((current) => {
      if (typeof document !== 'undefined' && document.activeElement === textareaRef.current) {
        return Math.min(current, nextLength);
      }
      return nextLength;
    });
    setScrollTop((current) => {
      const node = textareaRef.current;
      if (!node) {
        return 0;
      }
      const next = node.scrollTop;
      return current === next ? current : next;
    });
  }, [content]);

  const safeCaretIndex = Math.min(caretIndex, content.length);
  const caretBefore = content.slice(0, safeCaretIndex);
  const caretAfter = content.slice(safeCaretIndex);
  const isSplitPreview = previewMode === 'split';
  const showCaret = isFocused && !isSelecting && !isSplitPreview;
  const scrollOffsetStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!scrollTop) {
      return undefined;
    }
    return { transform: `translateY(${-scrollTop}px)` };
  }, [scrollTop]);

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
    (type: 'bold' | 'italic' | 'link' | 'heading' | 'bullet' | 'numbered' | 'task' | 'code' | 'quote') => {
      const node = textareaRef.current;
      if (!node) {
        return;
      }

      const value = node.value;
      const start = node.selectionStart ?? 0;
      const end = node.selectionEnd ?? 0;
      const selected = value.slice(start, end);

      const updateContent = (next: string, selectionStart: number, selectionEnd: number) => {
        onChange({ content: next });
        focusTextarea(selectionStart, selectionEnd);
      };

      const getSelectedLines = () => {
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const nextBreak = value.indexOf('\n', end);
        const lineEnd = nextBreak === -1 ? value.length : nextBreak;
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        return { lineStart, lineEnd, block, lines };
      };

      const applyLinePrefix = (prefix: string, removePattern?: RegExp) => {
        const { lineStart, lineEnd, lines } = getSelectedLines();
        const allPrefixed = lines.every((line) => line.trimStart().startsWith(prefix));
        const updatedLines = lines.map((line) => {
          const trimmed = line.trimStart();
          const leadingWhitespace = line.slice(0, line.length - trimmed.length);
          if (allPrefixed) {
            if (trimmed.startsWith(prefix)) {
              return leadingWhitespace + trimmed.slice(prefix.length);
            }
            return line;
          }
          const cleaned = removePattern ? trimmed.replace(removePattern, '') : trimmed;
          return `${leadingWhitespace}${prefix}${cleaned}`;
        });
        const updatedBlock = updatedLines.join('\n');
        const delta = updatedBlock.length - (lineEnd - lineStart);
        const next = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
        updateContent(next, lineStart, end + delta);
      };

      const applyNumberedList = () => {
        const { lineStart, lineEnd, lines } = getSelectedLines();
        const allNumbered = lines.every((line) => /^\s*\d+\.\s+/.test(line));
        const updatedLines = lines.map((line, index) => {
          const trimmed = line.trimStart();
          const leadingWhitespace = line.slice(0, line.length - trimmed.length);
          if (allNumbered) {
            return leadingWhitespace + trimmed.replace(/^\d+\.\s+/, '');
          }
          const cleaned = trimmed
            .replace(/^\d+\.\s+/, '')
            .replace(/^[-*+]\s+/, '')
            .replace(/^-\s*\[[ xX]\]\s+/, '');
          const label = cleaned.length ? cleaned : 'item';
          return `${leadingWhitespace}${index + 1}. ${label}`;
        });
        const updatedBlock = updatedLines.join('\n');
        const delta = updatedBlock.length - (lineEnd - lineStart);
        const next = value.slice(0, lineStart) + updatedBlock + value.slice(lineEnd);
        updateContent(next, lineStart, end + delta);
      };

      const applyCodeBlock = () => {
        const before = value.slice(0, start);
        const after = value.slice(end);
        const fence = '```';
        const requiresLeadingNewline = start > 0 && value[start - 1] !== '\n';
        const requiresTrailingNewline = end < value.length && value[end] !== '\n';
        const insertion = selected || 'code snippet';
        const prefix = requiresLeadingNewline ? '\n' : '';
        const suffix = requiresTrailingNewline ? '\n' : '';
        const snippet = `${fence}\n${insertion}\n${fence}`;
        const next = `${before}${prefix}${snippet}${suffix}${after}`;
        const insertionStart = before.length + prefix.length + fence.length + 1;
        updateContent(next, insertionStart, insertionStart + insertion.length);
      };

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

      if (type === 'heading') {
        applyLinePrefix('## ', /^#+\s+/);
        return;
      }

      if (type === 'bullet') {
        applyLinePrefix('- ', /^[-*+]\s+/);
        return;
      }

      if (type === 'numbered') {
        applyNumberedList();
        return;
      }

      if (type === 'task') {
        applyLinePrefix('- [ ] ', /^-\s*\[[ xX]\]\s+/);
        return;
      }

      if (type === 'quote') {
        applyLinePrefix('> ', /^>\s+/);
        return;
      }

      if (type === 'code') {
        applyCodeBlock();
        return;
      }
    },
    [focusTextarea, onChange]
  );

  const renderPreview = (className: string) =>
    content ? (
      <ReactMarkdown
        className={className}
        remarkPlugins={[remarkGfm, remarkBreaks, remarkPreserveFormattingMarkers, remarkHighlightTokens]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    ) : (
      <span className="capture-editor__preview-placeholder">Type your thought…</span>
    );

  return (
    <div className={`capture-editor${isSplitPreview ? ' capture-editor--split' : ''}`}>
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
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Heading"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('heading')}
            title="Insert heading"
          >
            H2
          </button>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Bulleted list"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('bullet')}
            title="Bulleted list"
          >
            *
          </button>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Numbered list"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('numbered')}
            title="Numbered list"
          >
            1.
          </button>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Task list"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('task')}
            title="Task list"
          >
            [ ]
          </button>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Code block"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('code')}
            title="Code block"
          >
            &lt;/&gt;
          </button>
          <button
            type="button"
            tabIndex={toolbarVisible ? 0 : -1}
            aria-label="Quote"
            className="capture-editor__tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting('quote')}
            title="Block quote"
          >
            &gt;
          </button>
        </div>
        <div className={`capture-editor__workspace${isSplitPreview ? ' capture-editor__workspace--split' : ''}`}>
          {!isSplitPreview ? (
            <div className="capture-editor__preview" aria-hidden="true" style={scrollOffsetStyle}>
              {renderPreview('capture-editor__preview-content')}
            </div>
          ) : null}
          {showCaret ? (
            <div className="capture-editor__caret-overlay" aria-hidden="true" style={scrollOffsetStyle}>
              <span>{caretBefore}</span>
              <span className="capture-editor__caret" />
              <span>{caretAfter || ' '}</span>
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => {
              onChange({ content: event.target.value });
              window.requestAnimationFrame(handleSelectionState);
            }}
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
            onScroll={(event) => {
              const next = event.currentTarget.scrollTop;
              setScrollTop((current) => (current === next ? current : next));
            }}
            className={`capture-editor__textarea${isSplitPreview ? ' capture-editor__textarea--split' : ''}`}
            placeholder="Type your thought… add #tag, @project, or !focus when it helps."
            rows={16}
          />
          {isSplitPreview ? (
            <div className="capture-editor__render-panel" aria-label="Markdown preview" aria-live="polite">
              {renderPreview('capture-editor__split-content')}
            </div>
          ) : null}
        </div>
        {showSlashHint || showMarkdownHint ? (
          <div className="capture-editor__preview-overlay">
            <span className="capture-editor__preview-hint">
              {showSlashHint ? 'Try / to open commands' : 'Markdown supported: # heading, - list, [link](url)'}
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
