import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import MarblesView from './src/components/MarblesView';
import BilliardsView from './src/components/BilliardsView';
import FourBallView from './src/components/FourBallView';
import IntroScreen, { GameMode } from './src/components/IntroScreen';

export default function App(): JSX.Element {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);

  const renderGame = () => {
    if (gameMode === 'marbles') return <MarblesView onBack={() => setGameMode(null)} />;
    if (gameMode === 'billiards') return <BilliardsView onBack={() => setGameMode(null)} />;
    if (gameMode === '4ball') return <FourBallView onBack={() => setGameMode(null)} />;
    return <IntroScreen onSelect={setGameMode} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      {gameMode === null ? <IntroScreen onSelect={setGameMode} /> : renderGame()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
});
