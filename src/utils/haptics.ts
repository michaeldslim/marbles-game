import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function canHaptic(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Light tap — nav, segment, secondary actions */
export function hapticLight(): void {
  if (!canHaptic()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap — primary CTAs, win actions */
export function hapticMedium(): void {
  if (!canHaptic()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Selection change — segmented control */
export function hapticSelection(): void {
  if (!canHaptic()) return;
  void Haptics.selectionAsync();
}
