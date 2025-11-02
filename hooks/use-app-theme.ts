// hooks/use-app-theme.ts
import { useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

export function useAppTheme() {
  const [scheme, setScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setScheme(colorScheme));
    return () => sub.remove();
  }, []);

  const effective = useMemo<'light' | 'dark'>(() => (scheme ?? 'light') as 'light' | 'dark', [scheme]);

  // Always ready, no persistence
  return { ready: true, effective };
}
