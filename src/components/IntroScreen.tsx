import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { t } from '../i18n';

export type GameMode = 'billiards' | '4ball' | '4ball-ai';

interface Props {
  onSelect: (mode: GameMode) => void;
  onSettings: () => void;
}

export default function IntroScreen({ onSelect, onSettings }: Props): JSX.Element {
  const { settings } = useSettings();
  const lang = settings.language ?? 'en';
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t(lang, 'chooseGameTitle')}</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={onSettings}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎱 {t(lang, 'play3C')}</Text>
        <Text style={styles.cardDesc}>{t(lang, 'cardDescBilliards')}</Text>
        <TouchableOpacity style={[styles.btn, styles.btnBilliards]} onPress={() => onSelect('billiards')}>
          <Text style={styles.btnText}>{t(lang, 'play3C')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🟡 4-Ball</Text>
        <Text style={styles.cardDesc}>{t(lang, 'cardDesc4Ball')}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btn4ball, styles.btnFlex]} onPress={() => onSelect('4ball')}>
            <Text style={styles.btnText}>{t(lang, 'play4B_2p')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnAI, styles.btnFlex]} onPress={() => onSelect('4ball-ai')}>
            <Text style={styles.btnText}>{t(lang, 'play4B_ai')} 🤖</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f7f7f7',
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 28, width: '100%',
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#e8e8e8',
    alignItems: 'center', justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20 },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    color: '#222',
  },
  cardDesc: {
    fontSize: 14,
    color: '#555',
    lineHeight: 21,
    marginBottom: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#222',
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnBilliards: {
    backgroundColor: '#2cc47a',
  },
  btn4ball: {
    backgroundColor: '#e8a020',
  },
  btnAI: {
    backgroundColor: '#7c3aed',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnFlex: {
    flex: 1,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
