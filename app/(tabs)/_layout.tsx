// app/(tabs)/_layout.tsx
import { Tabs, router, usePathname } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

import { useUnreadCount } from '@/hooks/use-unread-count';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  // Follow system theme only
  const { effective } = useAppTheme();
  const palette = Colors[effective === 'dark' ? 'dark' : 'light'];
  const pathname = usePathname();

  // Redirect to Profile when the tabs group is focused without a child
  useEffect(() => {
    if (pathname === '/(tabs)') {
      router.replace('/(tabs)/profile');
    }
  }, [pathname]);

  // Get current user id for unread badge
  const [userId, setUserId] = useState<string>('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? '');
    });
  }, []);

  const unread = useUnreadCount(userId);
  const badge = useMemo(() => (unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined), [unread]);

  return (
    <Tabs
      initialRouteName="profile"
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.card ?? palette.background,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Book Session',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="browse-slots"
        options={{
          title: 'Browse & Book',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="magnifyingglass.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: badge,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="envelope.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
