// app/_layout.tsx
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';

import { PastelNavDark, PastelNavLight } from '@/constants/nav-theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // useAppTheme now mirrors the OS scheme only (no manual toggle)
  const { ready, effective } = useAppTheme();

  // No flicker: wait until initial scheme is known
  if (!ready) return null;

  // Always recreate object so React Navigation re-themes when OS scheme changes
  const navTheme = effective === 'dark' ? { ...PastelNavDark } : { ...PastelNavLight };

  return (
    <ThemeProvider value={navTheme}>
      <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
        {/* Tabs is the entry point */}
        <Stack.Screen name="(tabs)" />

        {/* Public routes */}
        <Stack.Screen name="welcome" />

        {/* Auth flow */}
        <Stack.Screen name="(auth)/auth" />

        {/* Other screens */}
        <Stack.Screen name="chat" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
