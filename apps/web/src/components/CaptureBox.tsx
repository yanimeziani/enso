import React from 'react';
import type { AISuggestion, AIClientMode } from '@enso/core';
import type { CollectionId } from '../workspaceData';
import { useAISuggestions } from '../hooks/useAISuggestions';

import './CaptureBox.css';

export type CaptureSuggestions = {
  tagSuggestions: string[];
  focusHint?: string;
  showHints: boolean;
  showVoiceHint: boolean;
  microcopyTone: 'intro' | 'reinforce' | 'fade' | 'quiet';
};

type CaptureBoxAIOptions = {
  enabled: boolean;
  mode: AIClientMode;
  status: 'disabled' | 'checking' | 'ok' | 'unavailable';
  detail?: string | null;
};

type CaptureBoxProps = {
  onCapture: (payload: { text: string; tags: string[]; focus: boolean; project?: string; collectionOverride?: CollectionId }) => void;
  suggestions: CaptureSuggestions;
  onCommandPalette: () => void;
  placeholder: string;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  onDismiss: () => void;
  showCommandShortcuts: boolean;
  onCaptured?: () => void;
  showHeader?: boolean;
  headerLabel?: string;
  headerDescription?: string;
  showCommandShortcutButton?: boolean;
  showViewControls?: boolean;
  className?: string;
  initialValue?: string;
  aiOptions?: CaptureBoxAIOptions;
};

export type CaptureBoxHandle = {
  focus: () => void;
};

type AnySpeechRecognition = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

type SpeechRecognitionConstructor = new () => AnySpeechRecognition;

const parseTokens = (text: string) => {
  const tagRegex = /(?:^|\s)#([\p{L}0-9_-]+)/gu;
  const projectRegex = /(?:^|\s)@([\p{L}0-9_-]+)/gu;
  const focusRegex = /!(focus|deep|energy)/i;

  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  let project: string | undefined;
  projectRegex.lastIndex = 0;
  const projectMatch = projectRegex.exec(text);
  if (projectMatch) {
    project = projectMatch[1].toLowerCase();
  }

  const focus = focusRegex.test(text);

  return {
    tags: Array.from(tags),
    project,
    focus
  };
};

const CaptureBoxInner: React.ForwardRefRenderFunction<CaptureBoxHandle, CaptureBoxProps> = (
  {
    onCapture,
    suggestions,
    onCommandPalette,
    placeholder,
    isCollapsed,
    onCollapseToggle,
    onDismiss,
    showCommandShortcuts,
    onCaptured,
    showHeader = true,
    headerLabel,
    headerDescription,
    showCommandShortcutButton = true,
    showViewControls = true,
    className,
    initialValue,
    aiOptions
  },
  forwardedRef
) => {
  const [value, setValue] = React.useState(() => initialValue ?? '');
  const [lastCaptured, setLastCaptured] = React.useState<string>('');
  const [flashCapture, setFlashCapture] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const recognitionRef = React.useRef<AnySpeechRecognition | null>(null);
  const flashTimeoutRef = React.useRef<number | null>(null);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const voiceErrorTimeoutRef = React.useRef<number | null>(null);
  const [dismissedAiSuggestionIds, setDismissedAiSuggestionIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (initialValue === undefined) {
      return;
    }
    setValue(initialValue);
  }, [initialValue]);

  React.useImperativeHandle(forwardedRef, () => ({
    focus: () => textareaRef.current?.focus()
  }));

  const supportsVoiceCapture = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const candidate = (window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }).SpeechRecognition ??
      (window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }).webkitSpeechRecognition;
    return Boolean(candidate);
  }, []);

  React.useEffect(() => {
    if (!supportsVoiceCapture || typeof window === 'undefined') {
      return;
    }

    const Candidate =
      (window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }).SpeechRecognition ??
      (window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }).webkitSpeechRecognition;

    if (!Candidate) {
      return;
    }

    const instance = new Candidate();
    instance.lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    instance.interimResults = false;
    instance.continuous = false;
    instance.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setValue((previous) => {
          if (!previous) {
            return transcript.trim();
          }
          return `${previous.trim()} ${transcript.trim()}`.trim();
        });
      }
    };
    instance.onend = () => {
      setIsListening(false);
    };
    instance.onerror = (event) => {
      setIsListening(false);
      const reason = event?.error === 'not-allowed' ? 'Microphone permissions are blocked.' : 'Voice capture failed. Try again in a moment.';
      setVoiceError(reason);
    };
    recognitionRef.current = instance;

    return () => {
      instance.abort();
      recognitionRef.current = null;
    };
  }, [supportsVoiceCapture]);

  const tokens = React.useMemo(() => parseTokens(value), [value]);

  const aiEnabled = Boolean(aiOptions && aiOptions.enabled && aiOptions.status === 'ok');

  const aiPayload = React.useMemo(() => {
    if (!aiEnabled) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return {
      content: trimmed,
      tags: tokens.tags,
      mode: aiOptions?.mode,
      context: {
        project: tokens.project,
        focus: tokens.focus
      }
    };
  }, [aiEnabled, value, tokens, aiOptions]);

  const aiSuggestionsState = useAISuggestions(aiPayload, {
    enabled: aiEnabled,
    debounceMs: 500
  });

  React.useEffect(() => {
    if (!value.trim()) {
      setDismissedAiSuggestionIds([]);
    }
  }, [value]);

  React.useEffect(() => {
    if (!aiEnabled) {
      setDismissedAiSuggestionIds([]);
    }
  }, [aiEnabled]);

  const insertToken = (token: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setValue((previous) => (previous ? `${previous.trimEnd()} ${token} ` : `${token} `));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const needsSpaceBefore = Boolean(before) && !/\s$/u.test(before);
    const prefix = needsSpaceBefore ? `${before} ` : before;
    const suffix = (() => {
      if (!after) {
        return ' ';
      }
      return /^\s/u.test(after) ? after : ` ${after}`;
    })();
    const nextValue = `${prefix}${token}${suffix}`;
    setValue(nextValue);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        if (!textareaRef.current) {
          return;
        }
        const cursorPosition = prefix.length + token.length + 1;
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      });
    }
  };

  const filteredAISuggestions = React.useMemo(() => {
    if (!aiSuggestionsState.suggestions.length) {
      return [] as AISuggestion[];
    }
    const dismissed = new Set(dismissedAiSuggestionIds);
    return aiSuggestionsState.suggestions.filter((suggestion) => {
      const key = suggestion.id ?? suggestion.label;
      if (dismissed.has(key)) {
        return false;
      }
      if (suggestion.type === 'tag') {
        const normalized = (suggestion.value ?? suggestion.label).replace(/^#/, '').toLowerCase();
        return !tokens.tags.includes(normalized);
      }
      if (suggestion.type === 'project' && tokens.project) {
        return false;
      }
      if (suggestion.type === 'focus' && tokens.focus) {
        return false;
      }
      return true;
    });
  }, [aiSuggestionsState.suggestions, dismissedAiSuggestionIds, tokens]);

  const applyAISuggestion = (suggestion: AISuggestion) => {
    const key = suggestion.id ?? suggestion.label;
    if (suggestion.type === 'focus') {
      insertToken('!focus');
    } else if (suggestion.type === 'project' || suggestion.type === 'tag') {
      insertToken(suggestion.value ?? suggestion.label);
    } else if (suggestion.value) {
      insertToken(suggestion.value);
    }
    if (textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
    setDismissedAiSuggestionIds((current) => (current.includes(key) ? current : [...current, key]));
  };

  const dismissAISuggestion = (suggestion: AISuggestion) => {
    const key = suggestion.id ?? suggestion.label;
    setDismissedAiSuggestionIds((current) => (current.includes(key) ? current : [...current, key]));
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    onCapture({ text: trimmed, tags: tokens.tags, focus: tokens.focus, project: tokens.project });
    setLastCaptured(trimmed.split('\n')[0].slice(0, 120));
    setValue('');
    textareaRef.current?.focus();
    setFlashCapture(true);
    onCaptured?.();
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashCapture(false);
    }, 650);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.key === 'Enter' && (event.metaKey || event.ctrlKey)) || (event.key === 'Enter' && event.altKey)) {
      event.preventDefault();
      handleSubmit();
      return;
    }

    if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onCommandPalette();
    }
  };

  const toggleVoiceCapture = () => {
    if (!supportsVoiceCapture || !recognitionRef.current) {
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
      setVoiceError(null);
    } catch {
      setIsListening(false);
      setVoiceError('Voice capture unavailable right now. Check your microphone and try again.');
    }
  };

  React.useEffect(
    () => () => {
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (voiceErrorTimeoutRef.current) {
        window.clearTimeout(voiceErrorTimeoutRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!voiceError) {
      return;
    }

    if (voiceErrorTimeoutRef.current) {
      window.clearTimeout(voiceErrorTimeoutRef.current);
    }

    voiceErrorTimeoutRef.current = window.setTimeout(() => {
      setVoiceError(null);
      voiceErrorTimeoutRef.current = null;
    }, 6000);

    return () => {
      if (voiceErrorTimeoutRef.current) {
        window.clearTimeout(voiceErrorTimeoutRef.current);
        voiceErrorTimeoutRef.current = null;
      }
    };
  }, [voiceError]);

  const hintMessage = React.useMemo(() => {
    const baseCopyByTone: Record<CaptureSuggestions['microcopyTone'], string> = {
      intro: 'One box. Drop the thought and route it later.',
      reinforce: 'Capture first. Add #tags or !focus once it helps.',
      fade: '⌘ + Enter captures instantly. #tags and !focus are ready when you are.',
      quiet: '⌘ + Enter captures instantly.'
    };

    if (!suggestions.showHints) {
      return baseCopyByTone[suggestions.microcopyTone];
    }

    const hintParts: string[] = [];
    if (suggestions.tagSuggestions.length) {
      hintParts.push(`Try #${suggestions.tagSuggestions[0]}`);
    }
    if (suggestions.focusHint) {
      hintParts.push(suggestions.focusHint);
    }
    if (supportsVoiceCapture && suggestions.showVoiceHint) {
      hintParts.push('Tap mic to dictate');
    }

    if (!hintParts.length) {
      return baseCopyByTone[suggestions.microcopyTone];
    }

    return suggestions.microcopyTone === 'fade' ? `Hint: ${hintParts[0]}` : `Tip: ${hintParts.join(' • ')}`;
  }, [suggestions, supportsVoiceCapture]);

  const commandShortcuts = React.useMemo(() => {
    if (!showCommandShortcuts) {
      return [] as Array<{ label: string; token: string; description: string }>;
    }

    const list: Array<{ label: string; token: string; description: string }> = [];
    if (!tokens.focus) {
      list.push({ label: '!focus', token: '!focus', description: 'Pull into Now' });
    }
    if (!tokens.project) {
      list.push({ label: '@project', token: '@project', description: 'Assign project' });
    }
    suggestions.tagSuggestions.forEach((tag) => {
      if (!tokens.tags.includes(tag)) {
        list.push({ label: `#${tag}`, token: `#${tag}`, description: 'Add tag' });
      }
    });

    return list.slice(0, 4);
  }, [showCommandShortcuts, suggestions.tagSuggestions, tokens.focus, tokens.project, tokens.tags]);

  const composedClassName = React.useMemo(() => {
    const classes = ['capture-box'];
    if (flashCapture) {
      classes.push('capture-box--flash');
    }
    if (isCollapsed && showHeader) {
      classes.push('capture-box--collapsed');
    }
    if (className) {
      classes.push(className);
    }
    return classes.join(' ');
  }, [className, flashCapture, isCollapsed, showHeader]);

  const headingLabel = headerLabel ?? 'Quick capture';
  const headingDescription = headerDescription
    ? headerDescription
    : lastCaptured
    ? `Last capture: “${lastCaptured}”`
    : 'One box. Drop the thought and route it later.';

  return (
    <section className={composedClassName} aria-label="Quick capture" aria-expanded={showHeader ? !isCollapsed : true}>
      {showHeader ? (
        <div className="capture-box__header">
          <div className="capture-box__heading">
            <span className="capture-box__label">{headingLabel}</span>
            <span className="capture-box__description">{headingDescription}</span>
          </div>
          {(showCommandShortcutButton || showViewControls) && (
            <div className="capture-box__actions">
              {showCommandShortcutButton ? (
                <button type="button" className="capture-box__command" onClick={onCommandPalette}>
                  ⌘ + K
                </button>
              ) : null}
              {showViewControls ? (
                <div className="capture-box__view-controls">
                  <button type="button" onClick={onCollapseToggle} className="capture-box__view-control" aria-pressed={isCollapsed}>
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                  <button type="button" onClick={onDismiss} className="capture-box__view-control capture-box__view-control--dismiss">
                    Hide
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {showHeader && isCollapsed ? (
        <div className="capture-box__collapsed">
          <span className="capture-box__collapsed-text">
            {lastCaptured ? `Last capture: “${lastCaptured}”` : 'Quick capture is tucked away.'}
          </span>
          <button type="button" className="capture-box__collapsed-action" onClick={onCollapseToggle}>
            Expand
          </button>
        </div>
      ) : (
        <React.Fragment>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            className="capture-box__textarea"
            placeholder={placeholder}
            rows={5}
          />

          {aiOptions ? (
            <div className="capture-box__ai" aria-live="polite">
              <div className="capture-box__ai-header">
                <span className="capture-box__ai-label">AI suggests</span>
                {aiOptions.detail ? <span className="capture-box__ai-detail">{aiOptions.detail}</span> : null}
                {aiOptions.status === 'ok' && aiSuggestionsState.status === 'error' ? (
                  <button type="button" className="capture-box__ai-action" onClick={aiSuggestionsState.refresh}>
                    Retry
                  </button>
                ) : null}
              </div>
              {aiOptions.status === 'disabled' ? (
                <p className="capture-box__ai-message">Enable AI in settings to surface smart hints.</p>
              ) : aiOptions.status === 'checking' ? (
                <p className="capture-box__ai-message">Checking availability…</p>
              ) : aiOptions.status === 'unavailable' ? (
                <p className="capture-box__ai-message">Model unavailable. Start the local service to resume suggestions.</p>
              ) : aiSuggestionsState.status === 'loading' ? (
                <p className="capture-box__ai-message">Thinking…</p>
              ) : aiSuggestionsState.status === 'error' ? (
                <p className="capture-box__ai-message">AI couldn’t respond. Try again soon.</p>
              ) : filteredAISuggestions.length ? (
                <div className="capture-box__ai-chips">
                  {filteredAISuggestions.map((suggestion) => {
                    const key = suggestion.id ?? suggestion.label;
                    return (
                      <div key={key} className="capture-box__ai-chip">
                        <button
                          type="button"
                          className="capture-box__ai-chip-apply"
                          onClick={() => applyAISuggestion(suggestion)}
                        >
                          {suggestion.label}
                        </button>
                        <button
                          type="button"
                          className="capture-box__ai-chip-dismiss"
                          onClick={() => dismissAISuggestion(suggestion)}
                          aria-label={`Dismiss suggestion ${suggestion.label}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="capture-box__ai-message">No suggestions yet.</p>
              )}
            </div>
          ) : null}

          {commandShortcuts.length ? (
            <div className="capture-box__shortcuts" aria-label="Quick commands">
              {commandShortcuts.map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  className="capture-box__shortcut-chip"
                  onClick={() => insertToken(shortcut.token)}
                >
                  <span>{shortcut.label}</span>
                  <span className="capture-box__shortcut-chip-description">{shortcut.description}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="capture-box__footer">
            {tokens.project || tokens.focus || tokens.tags.length ? (
              <div className="capture-box__chips" aria-live="polite">
                {tokens.project ? <span className="capture-chip">@{tokens.project}</span> : null}
                {tokens.focus ? <span className="capture-chip capture-chip--focus">!focus</span> : null}
                {tokens.tags.map((tag) => (
                  <span key={tag} className="capture-chip">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className={`capture-box__hint-text capture-box__hint-text--${suggestions.microcopyTone}`}>
                {hintMessage}
              </span>
            )}

            <div className="capture-box__cta">
              {supportsVoiceCapture ? (
                <button
                  type="button"
                  className={`capture-box__voice${isListening ? ' capture-box__voice--active' : ''}`}
                  onClick={toggleVoiceCapture}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice capture' : 'Start voice capture'}
                >
                  {isListening ? '● Listening' : '🎤 Voice'}
                </button>
              ) : null}
              <span className="capture-box__shortcut">⌘ + Enter</span>
              <button type="button" className="capture-box__button" onClick={handleSubmit} disabled={!value.trim()}>
                Capture
              </button>
            </div>
            {isListening ? (
              <div className="capture-box__listening" role="status" aria-live="assertive">
                <span className="capture-box__listening-dot" aria-hidden="true" />
                Listening…
              </div>
            ) : null}
            {voiceError ? (
              <div className="capture-box__inline-error" role="status">
                {voiceError}
              </div>
            ) : null}
          </div>

        </React.Fragment>
      )}

      {flashCapture ? (
        <div className="capture-box__confirmation" aria-live="polite">
          <span className="capture-box__confirmation-icon" aria-hidden="true">
            ✓
          </span>
          Captured
        </div>
      ) : null}
      <span className="visually-hidden" aria-live="polite">
        {flashCapture ? 'Thought captured successfully' : ''}
      </span>
    </section>
  );
};

export const CaptureBox = React.forwardRef(CaptureBoxInner);

CaptureBox.displayName = 'CaptureBox';
