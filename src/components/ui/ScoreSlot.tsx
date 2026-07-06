import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, hud, radii, spacing, typography } from '../../theme';

interface Props {
  label: string;
  score: number;
  active: boolean;
  marbleColor?: string;
}

export default function ScoreSlot({ label, score, active, marbleColor }: Props): JSX.Element {
  return (
    <View style={[styles.card, active && styles.cardActive]}>
      {active ? <View style={styles.accentBar} /> : null}
      <View style={styles.content}>
        <View style={styles.labelRow}>
          {marbleColor ? <View style={[styles.marble, { backgroundColor: marbleColor }]} /> : null}
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={styles.score}>{score}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.scoreCard,
    borderRadius: radii.sm,
    overflow: 'hidden',
    height: hud.scoreboardHeight,
  },
  cardActive: {
    backgroundColor: colors.scoreCardActive,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  marble: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: typography.scoreLabel,
    fontWeight: '600',
    color: colors.textMuted,
  },
  score: {
    fontSize: typography.score,
    fontWeight: '800',
    color: colors.textOnDark,
  },
});
