import React from 'react';
import type { Thought } from '@enso/core';
import {
  HttpThoughtRepository,
  readCachedThoughts,
  writeCachedThoughts,
  stripWorkspaceMetadata
} from '@enso/core';
import { LynxButton, LynxScrollView, LynxText, LynxView } from '@enso/lynx';

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

export const EnsoMobileApp: React.FC = () => {
  const repositoryRef = React.useRef<HttpThoughtRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = new HttpThoughtRepository();
  }

  const [thoughts, setThoughts] = React.useState<Thought[]>(() =>
    readCachedThoughts().map((thought) => stripWorkspaceMetadata(thought))
  );
  const [selected, setSelected] = React.useState<Thought | null>(() => thoughts[0] ?? null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    const repo = repositoryRef.current!;
    let cancelled = false;

    const load = async () => {
      setIsRefreshing(true);
      try {
        const remote = await repo.list();
        if (cancelled) {
          return;
        }
        writeCachedThoughts(remote);
        setThoughts(remote.map((thought) => stripWorkspaceMetadata(thought)));
      } catch (error) {
        console.warn('Unable to refresh mobile thoughts', error);
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!thoughts.length) {
      setSelected(null);
      return;
    }

    if (!selected || !thoughts.some((thought) => thought.id === selected.id)) {
      setSelected(thoughts[0]);
    }
  }, [thoughts, selected]);

  return (
    <LynxView style={containerStyle}>
      <LynxText style={{ fontSize: 24, fontWeight: 700 }}>Enso Lynx Playground</LynxText>
      <LynxText style={{ color: '#4b5874' }}>
        This mock demonstrates how the Lynx runtime can render React-driven views before the native host is
        ready. Replace the primitives with actual Lynx components once the SDK is available.
      </LynxText>

      <LynxButton
        label={isRefreshing ? 'Refreshing…' : 'Refresh'}
        onPress={() => {
          const repo = repositoryRef.current!;
          setIsRefreshing(true);
          repo
            .list()
            .then((remote) => {
              writeCachedThoughts(remote);
              setThoughts(remote.map((thought) => stripWorkspaceMetadata(thought)));
            })
            .catch((error) => {
              console.warn('Unable to refresh thoughts', error);
            })
            .finally(() => setIsRefreshing(false));
        }}
      />

      <LynxScrollView style={{ gap: 12 }}>
        {thoughts.map((thought) => (
          <ThoughtCard key={thought.id} thought={thought} onInspect={setSelected} />
        ))}
      </LynxScrollView>

      <ThoughtDetail thought={selected} />
    </LynxView>
  );
};
