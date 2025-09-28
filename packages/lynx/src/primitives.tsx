import React from 'react';

type BaseStyle = React.CSSProperties;

type ViewProps = {
  style?: BaseStyle;
  children?: React.ReactNode;
  testID?: string;
};

type TextProps = {
  style?: BaseStyle;
  children?: React.ReactNode;
  numberOfLines?: number;
  testID?: string;
};

type ScrollViewProps = ViewProps & {
  horizontal?: boolean;
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  style?: BaseStyle;
  testID?: string;
};

const mergeStyles = (...styles: Array<BaseStyle | undefined>): BaseStyle => Object.assign({}, ...styles.filter(Boolean));

export const LynxView: React.FC<ViewProps> = ({ style, children, testID }) => (
  <div data-testid={testID} style={mergeStyles({ display: 'flex', flexDirection: 'column' }, style)}>
    {children}
  </div>
);

export const LynxScrollView: React.FC<ScrollViewProps> = ({ children, horizontal, style, testID }) => (
  <div
    data-testid={testID}
    style={mergeStyles(
      {
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        overflowX: horizontal ? 'auto' : 'hidden',
        overflowY: horizontal ? 'hidden' : 'auto',
        gap: 16,
        padding: 16
      },
      style
    )}
  >
    {children}
  </div>
);

export const LynxText: React.FC<TextProps> = ({ style, children, numberOfLines, testID }) => (
  <span
    data-testid={testID}
    style={mergeStyles(
      {
        display: 'block',
        color: '#10172a',
        fontSize: 16,
        lineHeight: '22px',
        overflow: numberOfLines === 1 ? 'hidden' : undefined,
        textOverflow: numberOfLines === 1 ? 'ellipsis' : undefined,
        whiteSpace: numberOfLines === 1 ? 'nowrap' : 'pre-line'
      },
      style
    )}
  >
    {children}
  </span>
);

export const LynxButton: React.FC<ButtonProps> = ({ label, onPress, style, testID }) => (
  <button
    data-testid={testID}
    type="button"
    style={mergeStyles(
      {
        padding: '12px 16px',
        borderRadius: 12,
        border: 'none',
        background: '#3654ff',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: 16,
        cursor: 'pointer'
      },
      style
    )}
    onClick={() => onPress?.()}
  >
    {label}
  </button>
);
