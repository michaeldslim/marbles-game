import { Alert } from 'react-native';
import { t, Lang } from '../../i18n';

export function confirmRestart(lang: Lang | undefined, onConfirm: () => void, skipConfirm = false): void {
  if (skipConfirm) {
    onConfirm();
    return;
  }
  Alert.alert(
    t(lang, 'confirmRestart'),
    t(lang, 'confirmRestartMessage'),
    [
      { text: t(lang, 'cancel'), style: 'cancel' },
      { text: t(lang, 'restart'), style: 'destructive', onPress: onConfirm },
    ],
  );
}
