import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../theme';

interface Props {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

export default function Scoreboard({ left, center, right }: Props): JSX.Element {
  return (
    <View style={styles.row}>
      {left}
      {center}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
    width: '100%',
  },
});
