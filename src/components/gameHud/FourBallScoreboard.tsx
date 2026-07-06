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
  turn: 'yellow' | 'white';
  vsAI: boolean;
  ballsHit: number;
  lastResult: string | null;
  ready: boolean;
  winner: 'yellow' | 'white' | null;
}

function resultTone(result: string | null): 'success' | 'danger' {
  if (result?.startsWith('+')) return 'success';
  return 'danger';
}

export default function FourBallScoreboard({
  lang,
  score1,
  score2,
  turn,
  vsAI,
  ballsHit,
  lastResult,
  ready,
  winner,
}: Props): JSX.Element {
  const p2Label = vsAI ? t(lang, 'ai') : t(lang, 'player2');
  const gameActive = !winner;

  const turnLabel = gameActive
    ? ready
      ? `${turn === 'yellow' ? t(lang, 'player1') : p2Label} ${t(lang, 'turnSuffix')}`
      : t(lang, 'shot')
    : undefined;

  const turnTone = gameActive && !ready ? 'shot' : 'neutral';

  return (
    <Scoreboard
      left={
        <ScoreSlot
          label={t(lang, 'player1')}
          score={score1}
          active={turn === 'yellow' && gameActive}
          marbleColor={colors.marbleYellow}
        />
      }
      center={
        <ScoreboardCenter
          statusLine={turnLabel}
          statusTone={turnTone}
        >
          <Text style={styles.statLine} numberOfLines={1}>
            {t(lang, 'redsLabel')}{' '}
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
          active={turn === 'white' && gameActive}
          marbleColor={vsAI ? colors.marbleAi : colors.marbleWhite}
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
