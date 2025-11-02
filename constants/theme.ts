// constants/theme.ts
/**
 * App color system: pastel grey and black variants for light/dark modes.
 * If you use Nativewind or Tamagui later, map these tokens to their theme system.
 */

import { Platform } from 'react-native';

// Pastel grey + black palette
const PASTEL_GREY = {
  50: '#F7F8F9',
  100: '#F2F3F5', // primary app background (light)
  200: '#E6E8EB',
  300: '#D7DADF',
  400: '#C8CCD2',
  500: '#B8BDC5',
  600: '#A0A6B0',
  700: '#8C8F93', // inactive tab text/icons
  800: '#6B6F75',
  900: '#4A4D52',
};

const BLACK = {
  900: '#0F0F10', // primary app background (dark)
  800: '#161618',
  700: '#1C1D20',
  600: '#2A2B2E',
  500: '#3A3D42',
  text: '#111111', // near-black text on light
};

const LIGHT_TINT = BLACK.text;     // active elements on light
const DARK_TINT = PASTEL_GREY[100]; // active elements on dark

export const Colors = {
  light: {
    // Surfaces & text
    text: BLACK.text,
    background: PASTEL_GREY[100],
    card: '#FFFFFF',
    mutedText: PASTEL_GREY[900],
    border: PASTEL_GREY[300],

    // UI accents
    tint: LIGHT_TINT,
    icon: PASTEL_GREY[700],
    tabIconDefault: PASTEL_GREY[700],
    tabIconSelected: LIGHT_TINT,

    // Inputs
    inputBg: '#FFFFFF',
    inputBorder: PASTEL_GREY[300],
  },
  dark: {
    // Surfaces & text
    text: PASTEL_GREY[100],
    background: BLACK[900],
    card: BLACK[800],
    mutedText: PASTEL_GREY[600],
    border: BLACK[600],

    // UI accents
    tint: DARK_TINT,
    icon: PASTEL_GREY[700],
    tabIconDefault: PASTEL_GREY[700],
    tabIconSelected: DARK_TINT,

    // Inputs
    inputBg: BLACK[700],
    inputBorder: BLACK[600],
  },
};

// Optional: export for convenience in components
export const PastelTheme = {
  light: Colors.light,
  dark: Colors.dark,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
