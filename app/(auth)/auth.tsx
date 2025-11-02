// app/(auth)/auth.tsx
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Auth() {
  const router = useRouter();
  // Follow system theme only
  const { effective } = useAppTheme();
  const P = Colors[effective === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to Profile when session becomes available
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        console.log('Auth state changed, user logged in:', session.user.id);
        router.replace('/(tabs)/profile'); // land on Profile, not Matches
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign up error', error.message);
    } else {
      Alert.alert('Verify', 'Check your email to confirm your account.');
      // If your project does not require email confirmation, optionally redirect now:
      // router.replace('/(tabs)/profile');
    }
  };

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign in error', error.message);
      console.log('Sign in error details:', error);
    } else {
      // Immediate redirect as an extra safeguard to beat any restored tab state
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center', backgroundColor: P.background }}>
      <Text style={{ color: P.text, fontSize: 20, fontWeight: '600', marginBottom: 12 }}>
        Sign In / Sign Up
      </Text>

      <Text style={{ color: P.text }}>Email</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        placeholder="you@example.com"
        placeholderTextColor={P.mutedText}
        style={{
          borderWidth: 1,
          borderColor: P.inputBorder,
          backgroundColor: P.inputBg,
          color: P.text,
          padding: 10,
          borderRadius: 8,
        }}
      />

      <Text style={{ color: P.text }}>Password</Text>
      <TextInput
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        placeholder="••••••••"
        placeholderTextColor={P.mutedText}
        style={{
          borderWidth: 1,
          borderColor: P.inputBorder,
          backgroundColor: P.inputBg,
          color: P.text,
          padding: 10,
          borderRadius: 8,
        }}
      />

      <Button title={loading ? 'Loading...' : 'Sign Up'} onPress={signUp} disabled={loading} color={P.tint} />
      <Button title={loading ? 'Loading...' : 'Sign In'} onPress={signIn} disabled={loading} color={P.tint} />
    </View>
  );
}
