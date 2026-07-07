import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Lang, t } from '../../i18n';
import { colors, radii, spacing, touch, typography } from '../../theme';
import { confirmRestart } from './confirmRestart';

interface Props {
  visible: boolean;
  lang: Lang | undefined;
  winnerLabel: string;
  winnerMarbleColor?: string;
  subtitle?: string;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  skipRestartConfirm?: boolean;
}

export default function WinOverlay({
  visible,
  lang,
  winnerLabel,
  winnerMarbleColor,
  subtitle,
  onPlayAgain,
  onBackToMenu,
  skipRestartConfirm = true,
}: Props): JSX.Element | null {
  if (!visible) return null;

  const handlePlayAgain = () => confirmRestart(lang, onPlayAgain, skipRestartConfirm);

  return (
    <View style={styles.scrim} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.trophy}>🏆</Text>
        <View style={styles.winnerRow}>
          {winnerMarbleColor ? (
            <View style={[styles.marbleDot, { backgroundColor: winnerMarbleColor }]} />
          ) : null}
          <Text style={styles.winnerText}>{winnerLabel}</Text>
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Pressable
          onPress={handlePlayAgain}
          accessibilityLabel={t(lang, 'playAgain')}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        >
          <Text style={styles.primaryBtnText}>{t(lang, 'playAgain')}</Text>
        </Pressable>
        <Pressable
          onPress={onBackToMenu}
          accessibilityLabel={t(lang, 'backToMenu')}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
        >
          <Text style={styles.secondaryBtnText}>{t(lang, 'backToMenu')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  card: {
    backgroundColor: colors.hudBg,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 240,
    maxWidth: '85%',
  },
  trophy: {
    fontSize: 36,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  marbleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  winnerText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textOnDark,
  },
  subtitle: {
    fontSize: typography.stat,
    color: colors.textMuted,
    marginTop: -spacing.xs,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    minHeight: touch.minSize,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnPressed: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: colors.textOnDark,
    fontSize: typography.label,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: touch.minSize,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.navGhost,
  },
  secondaryBtnPressed: {
    backgroundColor: colors.navGhostPressed,
  },
  secondaryBtnText: {
    color: colors.textOnDark,
    fontSize: typography.label,
    fontWeight: '600',
    opacity: 0.9,
  },
});
