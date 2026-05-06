import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import GameView from './src/components/GameView';
import IntroScreen, { GameMode } from './src/components/IntroScreen';

export default function App(): JSX.Element {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {gameMode === null ? (
        <IntroScreen onSelect={setGameMode} />
      ) : (
        <GameView gameMode={gameMode} onBack={() => setGameMode(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
});
