import { Lang, t } from '../../i18n';
import { colors } from '../../theme';

export function getBilliardsWinnerDisplay(
  winner: 1 | 2,
  vsAI: boolean,
  lang: Lang | undefined,
): { label: string; marbleColor: string } {
  if (winner === 1) {
    return { label: t(lang, 'player1'), marbleColor: colors.marbleWhite };
  }
  if (vsAI) {
    return { label: t(lang, 'ai'), marbleColor: colors.marbleAi };
  }
  return { label: t(lang, 'player2'), marbleColor: colors.marbleYellow };
}

export function getFourBallWinnerDisplay(
  winner: 'yellow' | 'white',
  vsAI: boolean,
  lang: Lang | undefined,
): { label: string; marbleColor: string } {
  if (winner === 'yellow') {
    return { label: t(lang, 'player1'), marbleColor: colors.marbleYellow };
  }
  if (vsAI) {
    return { label: t(lang, 'ai'), marbleColor: colors.marbleAi };
  }
  return { label: t(lang, 'player2'), marbleColor: colors.marbleWhite };
}
