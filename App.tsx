import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import GameView from './src/components/GameView';

export default function App(): JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <GameView />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
});
