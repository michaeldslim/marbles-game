import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Lang, t } from '../../i18n';
import { EnglishType, SpinType } from '../../game/shotTypes';
import { hud, spacing } from '../../theme';
import SegmentedControl from '../ui/SegmentedControl';
import PowerMeter from '../ui/PowerMeter';
import AiThinkingIndicator from '../ui/AiThinkingIndicator';

interface Props {
  lang: Lang | undefined;
  shotType: SpinType;
  english: EnglishType;
  onShotTypeChange: (key: SpinType) => void;
  onEnglishChange: (key: EnglishType) => void;
  charging: boolean;
  chargePower: number;
  onCancelCharge: () => void;
  aiThinking: boolean;
}

export default function ShotControls({
  lang,
  shotType,
  english,
  onShotTypeChange,
  onEnglishChange,
  charging,
  chargePower,
  onCancelCharge,
  aiThinking,
}: Props): JSX.Element {
  return (
    <View style={styles.row}>
      {aiThinking ? (
        <AiThinkingIndicator lang={lang} />
      ) : charging ? (
        <PowerMeter lang={lang} power={chargePower} onCancel={onCancelCharge} />
      ) : (
        <View style={styles.splitRow}>
          <View style={styles.half}>
            <SegmentedControl
              compact
              label={t(lang, 'spinSection')}
              variant="spin"
              value={shotType}
              onChange={onShotTypeChange}
              options={[
                { value: 'draw', label: t(lang, 'spinDraw') },
                { value: 'stop', label: t(lang, 'spinStop') },
                { value: 'follow', label: t(lang, 'spinFollow') },
              ]}
            />
          </View>
          <View style={styles.half}>
            <SegmentedControl
              compact
              label={t(lang, 'englishSection')}
              variant="english"
              value={english}
              onChange={onEnglishChange}
              options={[
                { value: 'left', label: t(lang, 'engLeft') },
                { value: 'none', label: t(lang, 'engNone') },
                { value: 'right', label: t(lang, 'engRight') },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    height: hud.techRowHeight,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splitRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    height: '100%',
    alignItems: 'stretch',
  },
  half: {
    flex: 1,
    justifyContent: 'center',
  },
});
