// constants/nav-theme.ts
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { PastelTheme } from './theme';

export const PastelNavLight: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: PastelTheme.light.background,
    card: PastelTheme.light.card,
    text: PastelTheme.light.text,
    border: PastelTheme.light.border,
    primary: PastelTheme.light.tint,
    notification: PastelTheme.light.tint,
  },
};

export const PastelNavDark: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: PastelTheme.dark.background,
    card: PastelTheme.dark.card,
    text: PastelTheme.dark.text,
    border: PastelTheme.dark.border,
    primary: PastelTheme.dark.tint,
    notification: PastelTheme.dark.tint,
  },
};
