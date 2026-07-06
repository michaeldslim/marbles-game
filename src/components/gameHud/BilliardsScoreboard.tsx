import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Lang, t } from '../../i18n';
import { colors, typography } from '../../theme';
import Scoreboard from '../ui/Scoreboard';
import ScoreboardCenter from '../ui/ScoreboardCenter';
import ScoreSlot from '../ui/ScoreSlot';

interface Props {
  lang: Lang | undefined;
  score1: number;
  score2: number;
  turn: 1 | 2;
  vsAI: boolean;
  cushionCount: number;
  ballsHit: number;
  lastResult: string | null;
  ready: boolean;
}

function resultTone(result: string | null): 'neutral' | 'success' | 'danger' {
  if (!result) return 'neutral';
  if (result.startsWith('+')) return 'success';
  return 'danger';
}

export default function BilliardsScoreboard({
  lang,
  score1,
  score2,
  turn,
  vsAI,
  cushionCount,
  ballsHit,
  lastResult,
  ready,
}: Props): JSX.Element {
  const p2Label = vsAI ? t(lang, 'ai') : t(lang, 'player2');

  const turnLabel = ready
    ? `${turn === 1 ? t(lang, 'player1') : p2Label} ${t(lang, 'turnSuffix')}`
    : t(lang, 'shot');

  const turnTone = ready ? 'neutral' : 'shot';

  return (
    <Scoreboard
      left={
        <ScoreSlot
          label={t(lang, 'player1')}
          score={score1}
          active={turn === 1 && ready}
          marbleColor={colors.marbleWhite}
        />
      }
      center={
        <ScoreboardCenter
          statusLine={turnLabel}
          statusTone={turnTone}
        >
          <Text style={styles.statLine} numberOfLines={1}>
            {t(lang, 'cushions')}{' '}
            <Text style={styles.statVal}>{cushionCount}/3</Text>
            {' · '}
            {t(lang, 'balls')}{' '}
            <Text style={styles.statVal}>{ballsHit}/2</Text>
            {lastResult ? (
              <>
                {' · '}
                <Text
                  style={[
                    styles.resultInline,
                    { color: resultTone(lastResult) === 'success' ? colors.accent : colors.danger },
                  ]}
                >
                  {lastResult}
                </Text>
              </>
            ) : null}
          </Text>
        </ScoreboardCenter>
      }
      right={
        <ScoreSlot
          label={p2Label}
          score={score2}
          active={turn === 2 && ready}
          marbleColor={vsAI ? colors.marbleAi : colors.marbleYellow}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  statLine: {
    fontSize: typography.stat,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  statVal: {
    fontSize: typography.statValue,
    fontWeight: '800',
    color: colors.textOnDark,
  },
  resultInline: {
    fontSize: typography.stat,
    fontWeight: '700',
  },
});
