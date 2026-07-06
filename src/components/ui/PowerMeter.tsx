import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lang, t } from '../../i18n';
import { colors, radii, spacing } from '../../theme';

interface Props {
  lang: Lang | undefined;
  power: number;
  onCancel: () => void;
}

function fillColor(power: number): string {
  if (power > 0.7) return colors.danger;
  if (power > 0.4) return colors.shot;
  return colors.accent;
}

export default function PowerMeter({ lang, power, onCancel }: Props): JSX.Element {
  const pct = Math.round(power * 100);

  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <Text style={styles.label}>{t(lang, 'tapToShoot')}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor(power) }]} />
        </View>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} accessibilityLabel={t(lang, 'cancel')}>
        <Text style={styles.cancelText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textOnDark,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  track: {
    width: '100%',
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 7,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 7,
  },
  pct: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 1,
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textOnDark,
    fontSize: 16,
    fontWeight: '800',
  },
});
