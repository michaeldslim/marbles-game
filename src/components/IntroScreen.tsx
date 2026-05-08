import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export type GameMode = 'billiards' | '4ball';

interface Props {
  onSelect: (mode: GameMode) => void;
  onSettings: () => void;
}

export default function IntroScreen({ onSelect, onSettings }: Props): JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Choose Your Game</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={onSettings}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎱 3-Cushion Billiards</Text>
        <Text style={styles.cardDesc}>
          Strike your white cue ball so it contacts at least{' '}
          <Text style={styles.bold}>3 cushions</Text> (rails) and hits{' '}
          <Text style={styles.bold}>both</Text> the yellow and red balls in a single shot to score.
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnBilliards]} onPress={() => onSelect('billiards')}>
          <Text style={styles.btnText}>Play 3-Cushion</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🟡 4-Ball Billiards</Text>
        <Text style={styles.cardDesc}>
          Strike your cue ball to hit{' '}
          <Text style={styles.bold}>all three</Text> object balls in a single shot to score.
          Coming soon!
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btn4ball]} onPress={() => onSelect('4ball')}>
          <Text style={styles.btnText}>Play 4-Ball</Text>
        </TouchableOpacity>
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
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
