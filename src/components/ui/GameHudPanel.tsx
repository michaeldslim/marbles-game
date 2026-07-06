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
    width: '100%',
    backgroundColor: colors.hudBg,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'stretch',
  },
});
