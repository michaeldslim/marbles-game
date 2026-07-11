import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import { hapticSelection } from '../../utils/haptics';
import type { Lang } from '../../i18n';

interface LanguageToggleProps {
  language: Lang;
  onChange: (lang: Lang) => void;
  compact?: boolean;
}

export default function LanguageToggle({ language, onChange, compact = false }: LanguageToggleProps): JSX.Element {
  const select = (lang: Lang) => {
    if (lang === language) return;
    hapticSelection();
    onChange(lang);
  };

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <TouchableOpacity
        style={[styles.chip, compact && styles.chipCompact, language === 'ko' && styles.chipActive]}
        onPress={() => select('ko')}
        accessibilityLabel="Korean"
        accessibilityState={{ selected: language === 'ko' }}
      >
        <Text style={[styles.chipText, language === 'ko' && styles.chipTextActive]}>KO</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, compact && styles.chipCompact, language === 'en' && styles.chipActive]}
        onPress={() => select('en')}
        accessibilityLabel="English"
        accessibilityState={{ selected: language === 'en' }}
      >
        <Text style={[styles.chipText, language === 'en' && styles.chipTextActive]}>EN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.navGhost,
    borderRadius: radii.sm,
    padding: 2,
  },
  rowCompact: {
    borderRadius: radii.sm + 2,
  },
  chip: {
    minWidth: 44,
    height: 36,
    borderRadius: radii.sm - 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  chipCompact: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: spacing.xs + 2,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    fontSize: typography.labelSm + 1,
    fontWeight: '700',
    color: colors.textOnDark,
    opacity: 0.75,
  },
  chipTextActive: {
    opacity: 1,
  },
});
