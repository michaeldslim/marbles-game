import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { t } from '../i18n';
import { colors, radii, spacing, touch, typography } from '../theme';
import { hapticLight, hapticMedium } from '../utils/haptics';
import LanguageToggle from './ui/LanguageToggle';
import type { Lang } from '../i18n';
import appConfig from '../../app.json';

const appVersion = appConfig.expo.version;

export type GameMode = 'billiards' | 'billiards-ai' | '4ball' | '4ball-ai';

interface Props {
  onSelect: (mode: GameMode) => void;
  onSettings: () => void;
}

export default function IntroScreen({ onSelect, onSettings }: Props): JSX.Element {
  const { settings, updateSetting } = useSettings();
  const lang = settings.language ?? 'en';

  const setLanguage = (next: Lang) => updateSetting('language', next);

  const selectMode = (mode: GameMode) => {
    hapticMedium();
    onSelect(mode);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerStrip}>
        <View style={styles.headerActions}>
          <LanguageToggle language={lang} onChange={setLanguage} compact />
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => { hapticLight(); onSettings(); }}
            accessibilityLabel={t(lang, 'settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {t(lang, 'chooseGameTitle')}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎱 {t(lang, 'play3C')}</Text>
        <Text style={styles.cardDesc}>{t(lang, 'cardDescBilliards')}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnAccent, styles.btnFlex]} onPress={() => selectMode('billiards')}>
            <Text style={styles.btnText}>{t(lang, 'play3C_2p')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnFelt, styles.btnFlex]} onPress={() => selectMode('billiards-ai')}>
            <Text style={styles.btnText}>{t(lang, 'play3C_ai')} 🤖</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.card, styles.cardLast]}>
        <Text style={styles.cardTitle}>🟡 4-Ball</Text>
        <Text style={styles.cardDesc}>{t(lang, 'cardDesc4Ball')}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnShot, styles.btnFlex]} onPress={() => selectMode('4ball')}>
            <Text style={styles.btnText}>{t(lang, 'play4B_2p')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnFelt, styles.btnFlex]} onPress={() => selectMode('4ball-ai')}>
            <Text style={styles.btnText}>{t(lang, 'play4B_ai')} 🤖</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.version}>v{appVersion}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.hudBg,
  },
  headerStrip: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.lg + 4,
    gap: spacing.sm + 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textOnDark,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  settingsBtn: {
    width: touch.minSize,
    height: touch.minSize,
    borderRadius: touch.minSize / 2,
    backgroundColor: colors.navGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20 },
  card: {
    width: '100%',
    backgroundColor: colors.scoreCard,
    borderRadius: radii.md + 2,
    padding: spacing.lg + 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.navGhost,
  },
  cardLast: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.score + 3,
    fontWeight: '700',
    marginBottom: spacing.sm + 2,
    color: colors.textOnDark,
  },
  cardDesc: {
    fontSize: typography.label,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md + 6,
  },
  btn: {
    borderRadius: radii.sm,
    paddingVertical: spacing.md + 1,
    alignItems: 'center',
    minHeight: touch.minSize,
    justifyContent: 'center',
  },
  btnAccent: {
    backgroundColor: colors.accent,
  },
  btnShot: {
    backgroundColor: colors.shot,
  },
  btnFelt: {
    backgroundColor: colors.felt,
    borderWidth: 1,
    borderColor: colors.scoreCardActive,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnFlex: {
    flex: 1,
  },
  btnText: {
    color: colors.textOnDark,
    fontWeight: '700',
    fontSize: typography.label + 3,
  },
  version: {
    fontSize: typography.stat,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
