import { useMemo, useState } from '@lynx-js/react';
import type { CSSProperties } from '@lynx-js/types';
import { normalizeThought } from '@thoughtz/core';
import type { Thought } from '@thoughtz/core';

type ThoughtList = readonly Thought[];

type ThoughtCardProps = {
  thought: Thought;
  onSelect: (id: Thought['id']) => void;
  isActive: boolean;
};

const seedThoughts = (): ThoughtList => [
  normalizeThought({
    title: 'Capture anything fast',
    content: 'Tap the quick capture card to jot ideas without losing flow.',
    tags: ['capture', 'speed']
  }),
  normalizeThought({
    title: 'Link related notes',
    content: 'Long-press a thought to create a relationship and surface it later.',
    tags: ['links', 'graph']
  }),
  normalizeThought({
    title: 'Daily review',
    content: 'Swipe through the inbox each morning to promote ideas or archive them.',
    tags: ['ritual']
  })
];

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '32px 24px',
  gap: '24px',
  minHeight: '100vh',
  backgroundColor: '#f4f6fb'
};

const headingStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#10172a'
};

const headerCopyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const subheadingStyle: CSSProperties = {
  color: '#4b5874',
  lineHeight: '22px'
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const cardBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '18px',
  padding: '20px',
  gap: '12px',
  backgroundColor: '#ffffff',
  borderWidth: '1px',
  borderColor: '#d0d7e2',
  borderStyle: 'solid'
};

const cardActiveStyle: CSSProperties = {
  borderColor: '#3654ff',
  boxShadow: '0px 8px 18px rgba(54, 84, 255, 0.18)'
};

const titleStyle: CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#19212d'
};

const bodyStyle: CSSProperties = {
  color: '#42526e',
  lineHeight: '20px'
};

const tagRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: '8px'
};

const tagStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '999px',
  backgroundColor: '#e4ecff',
  color: '#334466',
  fontSize: '12px',
  textTransform: 'lowercase'
};

const detailStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '18px',
  padding: '20px',
  gap: '12px',
  backgroundColor: '#f1f3f9',
  borderWidth: '1px',
  borderColor: '#c2c9d6',
  borderStyle: 'solid'
};

const captionStyle: CSSProperties = {
  fontSize: '12px',
  color: '#60708f'
};

const ThoughtCard = ({ thought, onSelect, isActive }: ThoughtCardProps) => {
  const cardStyle: CSSProperties = isActive ? { ...cardBaseStyle, ...cardActiveStyle } : cardBaseStyle;

  return (
    <view style={cardStyle} bindtap={() => onSelect(thought.id)}>
      <text style={titleStyle}>{thought.title}</text>
      <text style={bodyStyle}>{thought.content}</text>
      <view style={tagRowStyle}>
        {thought.tags.map((tag) => (
          <text key={tag} style={tagStyle}>
            #{tag}
          </text>
        ))}
      </view>
    </view>
  );
};

const ThoughtDetail = ({ thought }: { thought: Thought | null }) => {
  if (!thought) {
    return (
      <view style={detailStyle}>
        <text style={titleStyle}>Select a thought</text>
        <text style={bodyStyle}>Tap a card to load its full context and related actions.</text>
      </view>
    );
  }

  return (
    <view style={detailStyle}>
      <text style={titleStyle}>{thought.title}</text>
      <text style={bodyStyle}>{thought.content}</text>
      <text style={captionStyle}>Last touched {new Date(thought.updatedAt).toLocaleString()}</text>
      {thought.tags.length > 0 && (
        <view style={tagRowStyle}>
          {thought.tags.map((tag) => (
            <text key={tag} style={tagStyle}>
              #{tag}
            </text>
          ))}
        </view>
      )}
    </view>
  );
};

const useSeededThoughts = (): ThoughtList => useMemo(() => seedThoughts(), []);

export function App() {
  const thoughts = useSeededThoughts();
  const [activeId, setActiveId] = useState(() => thoughts[0]?.id ?? '');

  const activeThought = useMemo(
    () => thoughts.find((thought) => thought.id === activeId) ?? thoughts[0] ?? null,
    [activeId, thoughts]
  );

  return (
    <view style={containerStyle}>
      <view style={headerCopyStyle}>
        <text style={headingStyle}>Thoughtz Lynx Playground</text>
        <text style={subheadingStyle}>
          Mirrors the PRD capture and review flows. Replace the seeded data with repository-backed storage once
          sync is wired up.
        </text>
      </view>

      <scroll-view style={listStyle}>
        {thoughts.map((thought) => (
          <ThoughtCard key={thought.id} thought={thought} onSelect={setActiveId} isActive={thought.id === activeId} />
        ))}
      </scroll-view>

      <ThoughtDetail thought={activeThought} />
    </view>
  );
}
