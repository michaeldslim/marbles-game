import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Lang, t } from '../../i18n';
import { hud, radii } from '../../theme';
import IconButton from './IconButton';
import { confirmRestart } from './confirmRestart';

interface Props {
  lang: Lang | undefined;
  onBack: () => void;
  onRestart: () => void;
  skipRestartConfirm?: boolean;
  center?: React.ReactNode;
}

export default function GameHudNav({
  lang,
  onBack,
  onRestart,
  skipRestartConfirm = false,
  center,
}: Props): JSX.Element {
  const handleRestart = () => confirmRestart(lang, onRestart, skipRestartConfirm);

  return (
    <View style={styles.bar}>
      <IconButton
        icon="chevron-back"
        label={t(lang, 'back')}
        onPress={onBack}
        accessibilityLabel={t(lang, 'back')}
        compact
      />
      {center ? <View style={styles.center}>{center}</View> : null}
      <IconButton
        icon="refresh"
        label={t(lang, 'restart')}
        onPress={handleRestart}
        variant="danger"
        accessibilityLabel={t(lang, 'restart')}
        compact
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    height: hud.navBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderRadius: radii.sm,
    paddingHorizontal: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
