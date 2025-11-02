// app/index.tsx
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Index() {
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;

      if (uid) {
        router.replace('/(tabs)/profile'); // land on Profile for signed-in users
        return;
      }

      router.replace('/welcome'); // show the simple welcome page for guests
    };

    run();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
