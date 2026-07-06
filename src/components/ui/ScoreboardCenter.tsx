import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, hud, spacing, typography } from '../../theme';

export type StatusTone = 'neutral' | 'success' | 'danger' | 'shot';

interface Props {
  children: React.ReactNode;
  statusLine?: string;
  statusTone?: StatusTone;
}

const toneColors: Record<StatusTone, string> = {
  neutral: colors.textMuted,
  success: colors.accent,
  danger: colors.danger,
  shot: colors.shot,
};

export default function ScoreboardCenter({
  children,
  statusLine,
  statusTone = 'neutral',
}: Props): JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={styles.stats}>{children}</View>
      {statusLine ? (
        <Text style={[styles.status, { color: toneColors[statusTone] }]} numberOfLines={1}>
          {statusLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1.2,
    height: hud.scoreboardHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    overflow: 'hidden',
  },
  stats: {
    alignItems: 'center',
  },
  status: {
    fontSize: typography.turn,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
});
