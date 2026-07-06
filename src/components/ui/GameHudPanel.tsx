import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../theme';

interface Props {
  children: React.ReactNode;
}

export default function GameHudPanel({ children }: Props): JSX.Element {
  return <View style={styles.panel}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    width: '95%',
    backgroundColor: colors.hudBg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'stretch',
  },
});
