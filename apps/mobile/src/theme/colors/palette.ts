/**
 * Raw palette. Never reference these directly from a component — go through the
 * semantic maps in `./semantic`, so light/dark stay in sync.
 */

export const Palette = {
  white: '#ffffff',
  black: '#000000',
  /** App canvas — Claude's warm ivory paper. */
  canvas: '#F5F4EF',
  /** Dark-mode canvas — warm charcoal. */
  night: '#262624',
  /** Near-black warm ink for text and the solid primary pill. */
  ink: '#1F1E1D',
  /** Warm near-white that replaces the primary pill in dark mode. */
  paper: '#FAF9F5',

  /** Warm neutrals: 50–300 light fills and hairlines, 400–600 secondary ink, 700–950 dark surfaces. */
  stone: {
    50: '#FAF9F6',
    100: '#F0EEE6',
    200: '#E8E6DC',
    300: '#DEDBCF',
    400: '#A6A39A',
    500: '#908D85',
    600: '#65645E',
    650: '#5C5B55',
    700: '#45443F',
    800: '#3A3936',
    850: '#30302E',
    900: '#1F1E1D',
    950: '#141413',
  },

  /** Claude terracotta. 500 is the brand mark; 700 is the step that reads as text on the canvas. */
  clay: {
    50: '#FBF3EF',
    100: '#F7E6DE',
    200: '#EFCBBB',
    300: '#E6A68D',
    400: '#E08A6D',
    500: '#D97757',
    600: '#C2613F',
    700: '#A6492A',
    800: '#3F2A22',
    900: '#2E221D',
  },

  /**
   * Hue ramps. Steps follow one rule across every hue so they can be swapped:
   * 50–200 pale washes (muted fills), 300 light-mode ornaments,
   * 400 dark-mode marks, 500 light-mode marks, 600–700 AA text on pale fills,
   * 800–900 deep tints for dark-mode fills.
   */
  blue: {
    50: '#F3F9FF',
    100: '#E6F4FE',
    /** Pale "Pro" badge fill. */
    150: '#E3EEFB',
    200: '#CDE4FC',
    /** Badge ink on the dark badge fill. */
    250: '#9CC6F5',
    300: '#7FB8FA',
    400: '#3F8FE0',
    /** Selection check in dark mode. */
    450: '#4A9BEB',
    500: '#3C87F7',
    /** Selection check — the blue tick in pickers. */
    550: '#2C84DB',
    600: '#208AEF',
    /** Badge ink on the pale badge fill. */
    650: '#1F5FA8',
    700: '#1567C4',
    /** Dark badge fill. */
    850: '#1F3450',
    900: '#0D2440',
  },

  green: {
    100: '#E4F8EC',
    200: '#C4EDD5',
    400: '#3DD68C',
    500: '#2BA25F',
    700: '#1B7443',
    900: '#0F2A1B',
  },

  amber: {
    50: '#FFFAEE',
    100: '#FDF3DC',
    200: '#F9E2A8',
    300: '#F2C55C',
    500: '#E0A020',
    600: '#B98200',
    700: '#9C6B0E',
    800: '#8A5A00',
    900: '#2C2109',
  },

  red: {
    100: '#FDE9E9',
    400: '#FF6369',
    500: '#E5484D',
    600: '#C62A2F',
    700: '#AA2429',
    900: '#2E1213',
  },

  violet: {
    100: '#F0EBFE',
    200: '#DDD3FD',
    500: '#7C5CFC',
    700: '#5A3BD0',
    900: '#1F1640',
  },

  indigo: {
    100: '#ECEAFD',
    200: '#D4CFFA',
    300: '#B3AAF5',
    400: '#8A7BEB',
    500: '#6A5AE0',
    700: '#4535B0',
    900: '#1E1850',
  },

  teal: {
    50: '#F0FBF9',
    100: '#DDF5F1',
    200: '#B5EAE1',
    300: '#7FD6C8',
    400: '#1FA595',
    500: '#16968A',
    700: '#0F6B61',
    900: '#0A2E2A',
  },

  coral: {
    50: '#FFF5F1',
    100: '#FDE7DF',
    200: '#FBCDBC',
    300: '#F4A487',
    400: '#E36D45',
    500: '#DA6038',
    700: '#A8401E',
    900: '#3A1A10',
  },

  /** Pink-violet glow for the aura orb. */
  orchid: {
    300: '#E7AEF8',
    500: '#C47BEA',
  },

  /** Highlight marks. */
  yellow: {
    300: '#FBE25A',
    400: '#F2D335',
    500: '#EBC92B',
    700: '#B08A00',
  },

  /**
   * Quiet card tints — the colored surface tones, kept close to the paper so
   * they read as warm variants rather than pastels. `light` sits on the ivory
   * canvas, `dark` on the charcoal one.
   */
  tint: {
    clay: { light: '#FAF1EC', dark: '#3A302B' },
    lilac: { light: '#F4F2F6', dark: '#33323A' },
    slate: { light: '#EFF2F5', dark: '#2E3237' },
    wheat: { light: '#F8F4E8', dark: '#36332B' },
    sage: { light: '#EFF2EB', dark: '#2E332D' },
    blush: { light: '#F8EFEF', dark: '#373031' },
    oat: { light: '#F0EEE6', dark: '#353431' },
  },

  rose: {
    50: '#FFF4F8',
    100: '#FCE6EF',
    200: '#F8C9DB',
    300: '#F0A0BF',
    400: '#D65C8F',
    500: '#D5508A',
    700: '#9A2E5C',
    900: '#3A1225',
  },
} as const;
