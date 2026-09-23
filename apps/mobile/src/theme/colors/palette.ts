/**
 * Raw palette. Never reference these directly from a component — go through the
 * semantic maps in `./semantic`, so light/dark stay in sync.
 */

export const Palette = {
  white: '#ffffff',
  black: '#000000',
  /** App canvas — a warm off-white, one notch softer than pure white. */
  canvas: '#FCFCFB',

  /** Brand ramp. 500 is the primary; the rest are derived tints/shades. */
  periwinkle: {
    50: '#FAF8FF',
    100: '#EFEBFE',
    200: '#E3DDFD',
    300: '#D7D0FB',
    400: '#D0C8F9',
    500: '#C8BFF7',
    600: '#A496EE',
    700: '#7662DA',
    800: '#4633A3',
    900: '#261D53',
  },

  gray: {
    25: '#FCFCFD',
    50: '#F8F9FB',
    100: '#F0F0F3',
    200: '#E0E1E6',
    300: '#CDCED6',
    400: '#B0B4BA',
    500: '#8B8D98',
    600: '#60646C',
    700: '#3E4148',
    800: '#2E3135',
    900: '#212225',
    950: '#141416',
  },

  blue: {
    100: '#E6F4FE',
    300: '#7FB8FA',
    500: '#3C87F7',
    600: '#208AEF',
    700: '#1567C4',
  },

  green: {
    100: '#E4F8EC',
    500: '#2BA25F',
    700: '#1B7443',
  },

  amber: {
    100: '#FDF3DC',
    500: '#E0A020',
    700: '#9C6B0E',
  },

  red: {
    100: '#FDE9E9',
    500: '#E5484D',
    700: '#AA2429',
  },

  violet: {
    100: '#F0EBFE',
    500: '#7C5CFC',
    700: '#5A3BD0',
  },
} as const;
