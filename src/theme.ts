export const colors = {
  hudBg: '#1b4332',
  felt: '#2d6a4f',
  scoreCard: '#2d6a4f',
  scoreCardActive: '#357a5c',
  textOnDark: '#ffffff',
  textMuted: '#a8c5b8',
  navGhost: 'rgba(255,255,255,0.12)',
  navGhostPressed: 'rgba(255,255,255,0.22)',
  danger: '#e44',
  accent: '#2cc47a',
  shot: '#f4a020',
  win: '#f4c430',
  marbleYellow: '#f4c430',
  marbleWhite: '#f0f0f0',
  marbleAi: '#a8c5b8',
  /** Non-HUD screens (intro, settings scroll area) */
  screenBg: '#f7f7f7',
  surface: '#ffffff',
  surfaceMuted: '#e8e8e8',
  surfaceDim: '#f0f0f0',
  textOnLight: '#222222',
  textMutedLight: '#666666',
  descBg: '#e8f5ee',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16 };

export const radii = { sm: 6, md: 12 };

export const touch = { minSize: 44 };

export const typography = {
  label: 13,
  labelSm: 11,
  score: 17,
  scoreLabel: 11,
  stat: 10,
  statValue: 11,
  turn: 11,
};

/** Fixed HUD chrome heights — keep in sync with BOARD_UI_GAP budget */
export const hud = {
  navBarHeight: 32,
  navButtonHeight: 30,
  navButtonMinWidth: 68,
  /** Fixed tech slot — matches power-meter height so board size never jumps when charging. */
  techRowHeight: 42,
  scoreboardHeight: 40,
  panelPaddingTop: spacing.sm,
  panelPaddingBottom: 0,
  panelGap: spacing.xs * 2,
  get chromeHeight() {
    return (
      this.panelPaddingTop
      + this.panelPaddingBottom
      + this.panelGap
      + this.navBarHeight
      + this.scoreboardHeight
      + this.techRowHeight
    );
  },
};

/** Initial HUD budget; board layout uses this fixed value (not dynamic onLayout). */
export const BOARD_UI_GAP = hud.chromeHeight;
