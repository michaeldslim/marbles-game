import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export type GameMode = 'marbles' | 'billiards' | '4ball';

interface Props {
  onSelect: (mode: GameMode) => void;
}

export default function IntroScreen({ onSelect }: Props): JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Choose Your Game</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔵 Marbles</Text>
        <Text style={styles.cardDesc}>
          Launch your red marble into a pile and knock marbles out of the boundary ring.
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnMarbles]} onPress={() => onSelect('marbles')}>
          <Text style={styles.btnText}>Play Marbles</Text>
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 28,
    color: '#222',
  },
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
  btnMarbles: {
    backgroundColor: '#2a9df4',
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
