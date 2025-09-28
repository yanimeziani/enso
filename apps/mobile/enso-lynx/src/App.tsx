import { useEffect, useMemo, useState } from '@lynx-js/react';
import type { CSSProperties } from '@lynx-js/types';
import type { CollectionId, WorkspaceEntry, WorkspaceStatus } from '@enso/core';
import {
  workspaceEntries as seedEntries,
  workspaceEntryFromThought,
  readCachedThoughts,
  writeCachedThoughts,
  HttpThoughtRepository
} from '@enso/core';

type CollectionFilter = CollectionId | 'all';
type EnergyLevel = WorkspaceEntry['energy'];
type MomentumState = WorkspaceEntry['momentum'];

const statusOrder: WorkspaceStatus[] = ['now', 'inbox', 'snoozed', 'archive'];
const statusLabel: Record<WorkspaceStatus, string> = {
  now: 'Now',
  inbox: 'Inbox',
  snoozed: 'Snoozed',
  archive: 'Archive'
};
const statusDescription: Record<WorkspaceStatus, string> = {
  now: 'High-focus notes ready to ship.',
  inbox: 'Fresh captures waiting for triage.',
  snoozed: 'Ideas paused until the right moment.',
  archive: 'Past decisions and learnings.'
};

const collectionOrder: CollectionId[] = ['daily-review', 'projects', 'inbox', 'archive'];
const collectionLabel: Record<CollectionId, string> = {
  'daily-review': 'Daily review',
  projects: 'Projects',
  inbox: 'Inbox',
  archive: 'Archive'
};

const momentumLabel: Record<MomentumState, string> = {
  flow: 'In flow',
  steady: 'Steady progress',
  parked: 'Parked for later'
};

const energyLabel: Record<EnergyLevel, string> = {
  high: 'High focus',
  medium: 'Medium focus',
  low: 'Low effort'
};

const energyBadgeStyle: Record<EnergyLevel, CSSProperties> = {
  high: {
    backgroundColor: 'rgba(54, 84, 255, 0.12)',
    color: '#1f37c7'
  },
  medium: {
    backgroundColor: 'rgba(31, 138, 112, 0.12)',
    color: '#116b52'
  },
  low: {
    backgroundColor: 'rgba(180, 83, 9, 0.12)',
    color: '#8f3f00'
  }
};

const momentumBadgeStyle: Record<MomentumState, CSSProperties> = {
  flow: {
    backgroundColor: 'rgba(98, 89, 255, 0.12)',
    color: '#5b50ff'
  },
  steady: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#2563eb'
  },
  parked: {
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
    color: '#475569'
  }
};

const screenStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f4f6fb'
};

const contentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  padding: '32px 24px 40px'
};

const headerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const titleStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#10172a'
};

const subtitleStyle: CSSProperties = {
  color: '#4b5874',
  lineHeight: '22px'
};

const summaryGridStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: '12px'
};

const summaryCardStyle: CSSProperties = {
  flexGrow: 1,
  flexBasis: '48%',
  minWidth: '150px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  borderRadius: '18px',
  padding: '16px',
  backgroundColor: '#ffffff',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#d0d7e2',
  boxShadow: '0px 6px 14px rgba(16, 23, 42, 0.04)'
};

const summaryMetricStyle: CSSProperties = {
  fontSize: '24px',
  fontWeight: '700'
};

const summaryCaptionStyle: CSSProperties = {
  color: '#4b5874',
  fontSize: '12px'
};

const statusRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: '8px'
};

const statusPillBaseStyle: CSSProperties = {
  padding: '10px 16px',
  borderRadius: '999px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#d0d7e2',
  backgroundColor: '#ffffff',
  color: '#10172a',
  fontWeight: '600'
};

const statusPillActiveStyle: CSSProperties = {
  borderColor: '#3654ff',
  backgroundColor: '#e8edff',
  color: '#1f37c7'
};

const filterSubtitleStyle: CSSProperties = {
  fontSize: '12px',
  color: '#6b768d'
};

const collectionRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: '8px'
};

const collectionChipBaseStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: '14px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#d8deeb',
  backgroundColor: '#ffffff',
  color: '#25324c'
};

const collectionChipActiveStyle: CSSProperties = {
  borderColor: '#5b50ff',
  backgroundColor: '#f2f0ff',
  color: '#3d2df5'
};

const listWrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const cardBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  borderRadius: '18px',
  padding: '20px',
  backgroundColor: '#ffffff',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#d0d7e2'
};

const cardActiveStyle: CSSProperties = {
  borderColor: '#3654ff',
  boxShadow: '0px 10px 22px rgba(54, 84, 255, 0.16)'
};

const cardTitleRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px'
};

const cardTitleStyle: CSSProperties = {
  flex: 1,
  fontSize: '18px',
  fontWeight: '600',
  color: '#19212d'
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: '6px'
};

const chipStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '12px',
  fontSize: '12px',
  backgroundColor: '#eef2ff',
  color: '#3b43c6'
};

const cardSubtitleStyle: CSSProperties = {
  color: '#4b5874',
  fontSize: '14px'
};

const cardBodyStyle: CSSProperties = {
  color: '#394867',
  lineHeight: '20px',
  fontSize: '14px'
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: '8px',
  alignItems: 'center'
};

const badgeStyle: CSSProperties = {
  padding: '6px 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: '600'
};

const metaTextStyle: CSSProperties = {
  fontSize: '12px',
  color: '#5d6a85'
};

const trendRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px'
};

const trendBarRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: '4px',
  alignItems: 'flex-end'
};

const trendLabelStyle: CSSProperties = {
  fontSize: '12px',
  color: '#6b768d'
};

const detailContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '20px',
  borderRadius: '20px',
  backgroundColor: '#f1f3f9',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#cbd3e4'
};

const detailTitleStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#19212d'
};

const detailSubtitleStyle: CSSProperties = {
  fontSize: '14px',
  color: '#4b5874'
};

const detailBodyStyle: CSSProperties = {
  color: '#36405b',
  lineHeight: '22px'
};

const detailCaptionStyle: CSSProperties = {
  fontSize: '12px',
  color: '#6b768d'
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '24px',
  borderRadius: '18px',
  backgroundColor: '#ffffff',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: '#d0d7e2',
  color: '#4b5874'
};

const ActivityTrend = ({ values }: { values?: number[] }) => {
  if (!values || values.length === 0) {
    return null;
  }

  const max = Math.max(...values, 1);

  return (
    <view style={trendRowStyle}>
      <text style={trendLabelStyle}>Last 7 days</text>
      <view style={trendBarRowStyle}>
        {values.map((value, index) => {
          const height = Math.max(8, Math.round((value / max) * 36));
          const barStyle: CSSProperties = {
            width: '8px',
            height: `${height}px`,
            borderRadius: '6px',
            backgroundColor: '#3654ff'
          };
          return <view key={`${index}-${value}`} style={barStyle} />;
        })}
      </view>
    </view>
  );
};

const ThoughtCard = ({ entry, onSelect, isActive }: { entry: WorkspaceEntry; onSelect: (id: string) => void; isActive: boolean }) => {
  const cardStyle: CSSProperties = isActive ? { ...cardBaseStyle, ...cardActiveStyle } : cardBaseStyle;
  const { thought } = entry;

  return (
    <view style={cardStyle} bindtap={() => onSelect(thought.id)}>
      <view style={cardTitleRowStyle}>
        <text style={cardTitleStyle}>{thought.title}</text>
        <view style={{ ...badgeStyle, ...momentumBadgeStyle[entry.momentum] }}>{momentumLabel[entry.momentum]}</view>
      </view>
      <text style={cardSubtitleStyle}>{entry.subtitle}</text>
      <text style={cardBodyStyle}>{thought.content}</text>
      <view style={metaRowStyle}>
        <view style={{ ...badgeStyle, ...energyBadgeStyle[entry.energy] }}>{energyLabel[entry.energy]}</view>
        <text style={metaTextStyle}>{collectionLabel[entry.collection]}</text>
      </view>
      {thought.tags.length > 0 && (
        <view style={chipRowStyle}>
          {thought.tags.map((tag) => (
            <text key={tag} style={chipStyle}>
              #{tag}
            </text>
          ))}
        </view>
      )}
      <ActivityTrend values={entry.activityTrend} />
    </view>
  );
};

const ThoughtDetail = ({ entry }: { entry: WorkspaceEntry | null }) => {
  if (!entry) {
    return (
      <view style={emptyStateStyle}>
        <text>No notes match this view yet.</text>
        <text>Try switching status or collections to continue.</text>
      </view>
    );
  }

  const { thought } = entry;
  const created = new Date(thought.createdAt).toLocaleString();
  const updated = new Date(thought.updatedAt).toLocaleString();

  return (
    <view style={detailContainerStyle}>
      <text style={detailTitleStyle}>{thought.title}</text>
      <text style={detailSubtitleStyle}>{entry.subtitle}</text>
      <view style={metaRowStyle}>
        <view style={{ ...badgeStyle, ...momentumBadgeStyle[entry.momentum] }}>{momentumLabel[entry.momentum]}</view>
        <view style={{ ...badgeStyle, ...energyBadgeStyle[entry.energy] }}>{energyLabel[entry.energy]}</view>
      </view>
      <text style={detailBodyStyle}>{thought.content}</text>
      {thought.tags.length > 0 && (
        <view style={chipRowStyle}>
          {thought.tags.map((tag) => (
            <text key={tag} style={chipStyle}>
              #{tag}
            </text>
          ))}
        </view>
      )}
      <ActivityTrend values={entry.activityTrend} />
      <text style={detailCaptionStyle}>Captured {created}</text>
      <text style={detailCaptionStyle}>Last touched {updated}</text>
    </view>
  );
};

const buildSummaryCards = (entries: WorkspaceEntry[]) => {
  const flowCount = entries.filter((entry) => entry.momentum === 'flow').length;
  const steadyCount = entries.filter((entry) => entry.momentum === 'steady').length;
  const inboxCount = entries.filter((entry) => entry.status === 'inbox').length;
  const tagCount = entries.reduce((total, entry) => total + entry.thought.tags.length, 0);

  return [
    {
      id: 'flow',
      label: 'In flow',
      value: flowCount,
      caption: 'High momentum notes',
      accent: '#3654ff'
    },
    {
      id: 'steady',
      label: 'Steady',
      value: steadyCount,
      caption: 'Progressing calmly',
      accent: '#1f8a70'
    },
    {
      id: 'inbox',
      label: 'Inbox',
      value: inboxCount,
      caption: 'Needs triage',
      accent: '#b45309'
    },
    {
      id: 'tags',
      label: 'Active tags',
      value: tagCount,
      caption: 'Across workspace',
      accent: '#6a21ff'
    }
  ];
};

export function App() {
  const repository = useMemo(() => new HttpThoughtRepository(), []);
  const [entries, setEntries] = useState<WorkspaceEntry[]>(() => {
    const cached = readCachedThoughts();
    if (cached.length) {
      return cached.map((thought) => workspaceEntryFromThought(thought));
    }
    return seedEntries;
  });
  const summaryCards = useMemo(() => buildSummaryCards(entries), [entries]);
  const [activeStatus, setActiveStatus] = useState<WorkspaceStatus>('now');
  const [activeCollection, setActiveCollection] = useState<CollectionFilter>('all');
  const [activeId, setActiveId] = useState(() => entries[0]?.thought.id ?? '');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const remote = await repository.list();
        if (cancelled) {
          return;
        }
        writeCachedThoughts(remote);
        setEntries(remote.map((thought) => workspaceEntryFromThought(thought)));
      } catch (error) {
        console.warn('Unable to hydrate Lynx workspace', error);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [repository]);

  const statusOptions = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        label: statusLabel[status],
        count: entries.filter((entry) => entry.status === status).length
      })),
    [entries]
  );

  const availableCollections = useMemo(
    () => collectionOrder.filter((collection) => entries.some((entry) => entry.collection === collection)),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.status !== activeStatus) {
        return false;
      }
      if (activeCollection === 'all') {
        return true;
      }
      return entry.collection === activeCollection;
    });
  }, [entries, activeStatus, activeCollection]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setActiveId('');
      return;
    }

    const stillVisible = filteredEntries.some((entry) => entry.thought.id === activeId);
    if (!stillVisible) {
      setActiveId(filteredEntries[0]?.thought.id ?? '');
    }
  }, [filteredEntries, activeId]);

  const activeEntry = useMemo(
    () => filteredEntries.find((entry) => entry.thought.id === activeId) ?? filteredEntries[0] ?? null,
    [filteredEntries, activeId]
  );

  return (
    <scroll-view style={screenStyle}>
      <view style={contentStyle}>
        <view style={headerStyle}>
          <text style={titleStyle}>Enso Workspace</text>
          <text style={subtitleStyle}>Matches the web view while tuned for fast mobile browsing.</text>
        </view>

        <view style={summaryGridStyle}>
          {summaryCards.map((card) => (
            <view key={card.id} style={summaryCardStyle}>
              <text style={{ ...summaryMetricStyle, color: card.accent }}>{`${card.value}`}</text>
              <text style={{ fontWeight: '600', color: '#10172a' }}>{card.label}</text>
              <text style={summaryCaptionStyle}>{card.caption}</text>
            </view>
          ))}
        </view>

        <view style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <text style={filterSubtitleStyle}>Status</text>
          <view style={statusRowStyle}>
            {statusOptions.map(({ status, label, count }) => {
              const active = status === activeStatus;
              const pillStyle = active ? { ...statusPillBaseStyle, ...statusPillActiveStyle } : statusPillBaseStyle;
              return (
                <view
                  key={status}
                  style={pillStyle}
                  bindtap={() => {
                    setActiveStatus(status);
                    setActiveCollection('all');
                  }}
                >
                  <text>
                    {label}
                    {count > 0 ? ` (${count})` : ''}
                  </text>
                </view>
              );
            })}
          </view>
        </view>

        <view style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <text style={filterSubtitleStyle}>Collections</text>
          <view style={collectionRowStyle}>
            <view
              style={activeCollection === 'all' ? { ...collectionChipBaseStyle, ...collectionChipActiveStyle } : collectionChipBaseStyle}
              bindtap={() => setActiveCollection('all')}
            >
              <text>All</text>
            </view>
            {availableCollections.map((collection) => {
              const active = activeCollection === collection;
              const chipStyleFinal = active
                ? { ...collectionChipBaseStyle, ...collectionChipActiveStyle }
                : collectionChipBaseStyle;
              return (
                <view key={collection} style={chipStyleFinal} bindtap={() => setActiveCollection(collection)}>
                  <text>{collectionLabel[collection]}</text>
                </view>
              );
            })}
          </view>
        </view>

        <view style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <text style={filterSubtitleStyle}>{statusDescription[activeStatus]}</text>
        </view>

        <view style={listWrapperStyle}>
          {filteredEntries.length === 0 ? (
            <view style={emptyStateStyle}>
              <text>No notes in this combination yet.</text>
              <text>Adjust filters or capture on web to populate it.</text>
            </view>
          ) : (
            filteredEntries.map((entry) => (
              <ThoughtCard key={entry.thought.id} entry={entry} onSelect={setActiveId} isActive={entry.thought.id === activeId} />
            ))
          )}
        </view>

        <ThoughtDetail entry={activeEntry} />
      </view>
    </scroll-view>
  );
}
