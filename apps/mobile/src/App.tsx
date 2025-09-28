import React from 'react';
import { normalizeThought } from '@thoughtz/core';
import type { Thought } from '@thoughtz/core';
import { LynxButton, LynxScrollView, LynxText, LynxView } from '@thoughtz/lynx';

const containerStyle: React.CSSProperties = {
  gap: 24,
  padding: 24,
  minHeight: '100vh',
  background: '#f4f6fb'
};

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid #d0d7e2',
  background: '#ffffff',
  padding: 16,
  gap: 8
};

const tagPillStyle: React.CSSProperties = {
  background: '#e4ecff',
  color: '#334466',
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 12,
  textTransform: 'lowercase'
};

const seedThoughts = (): Thought[] => [
  normalizeThought({
    title: 'Tap to capture',
    content: 'Mobile-first capture flow with offline buffering.',
    tags: ['mobile', 'capture']
  }),
  normalizeThought({
    title: 'Daily review ritual',
    content: 'Guide users through the morning review in three swipes.',
    tags: ['ritual']
  }),
  normalizeThought({
    title: 'Link via swipe',
    content: 'Long-press to reveal relationship actions between thoughts.',
    tags: ['links']
  })
];

const ThoughtCard: React.FC<{ thought: Thought; onInspect: (thought: Thought) => void }> = ({ thought, onInspect }) => (
  <LynxView style={cardStyle}>
    <LynxText style={{ fontSize: 18, fontWeight: 600 }}>{thought.title}</LynxText>
    <LynxText style={{ color: '#42526e' }}>{thought.content}</LynxText>
    <LynxView style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {thought.tags.map((tag) => (
        <LynxText key={tag} style={tagPillStyle}>
          #{tag}
        </LynxText>
      ))}
    </LynxView>
    <LynxButton label="Inspect" onPress={() => onInspect(thought)} />
  </LynxView>
);

const ThoughtDetail: React.FC<{ thought: Thought | null }> = ({ thought }) => {
  if (!thought) {
    return (
      <LynxView style={cardStyle}>
        <LynxText style={{ fontWeight: 600 }}>Select a thought to preview context.</LynxText>
        <LynxText style={{ color: '#42526e' }}>
          This panel mirrors the deep-link detail experience described in the PRD.
        </LynxText>
      </LynxView>
    );
  }

  return (
    <LynxView style={cardStyle}>
      <LynxText style={{ fontSize: 18, fontWeight: 600 }}>{thought.title}</LynxText>
      <LynxText style={{ color: '#42526e' }}>{thought.content}</LynxText>
      <LynxText style={{ color: '#60708f', fontSize: 13 }}>Last touched {new Date(thought.updatedAt).toLocaleString()}</LynxText>
    </LynxView>
  );
};

export const ThoughtzMobileApp: React.FC = () => {
  const [thoughts] = React.useState<Thought[]>(() => seedThoughts());
  const [selected, setSelected] = React.useState<Thought | null>(() => thoughts[0] ?? null);

  return (
    <LynxView style={containerStyle}>
      <LynxText style={{ fontSize: 24, fontWeight: 700 }}>Thoughtz Lynx Playground</LynxText>
      <LynxText style={{ color: '#4b5874' }}>
        This mock demonstrates how the Lynx runtime can render React-driven views before the native host is
        ready. Replace the primitives with actual Lynx components once the SDK is available.
      </LynxText>

      <LynxScrollView style={{ gap: 12 }}>
        {thoughts.map((thought) => (
          <ThoughtCard key={thought.id} thought={thought} onInspect={setSelected} />
        ))}
      </LynxScrollView>

      <ThoughtDetail thought={selected} />
    </LynxView>
  );
};
