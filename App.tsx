import React, { useState } from 'react';
import { StyleSheet, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import BilliardsView from './src/components/BilliardsView';
import FourBallView from './src/components/FourBallView';
import IntroScreen, { GameMode } from './src/components/IntroScreen';
import SettingsScreen from './src/components/SettingsScreen';
import { SettingsProvider } from './src/context/SettingsContext';

export default function App(): JSX.Element {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const renderContent = () => {
    if (showSettings) return <SettingsScreen onBack={() => setShowSettings(false)} />;
    if (gameMode === 'billiards' || gameMode === 'billiards-ai') return <BilliardsView vsAI={gameMode === 'billiards-ai'} onBack={() => setGameMode(null)} />;
    if (gameMode === '4ball' || gameMode === '4ball-ai') return <FourBallView vsAI={gameMode === '4ball-ai'} onBack={() => setGameMode(null)} />;
    return <IntroScreen onSelect={setGameMode} onSettings={() => setShowSettings(true)} />;
  };

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        {Platform.OS === 'android' && (
          <StatusBar translucent={false} backgroundColor="#f7f7f7" barStyle="dark-content" />
        )}
        <SafeAreaView style={styles.container}>
          {renderContent()}
        </SafeAreaView>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
});
