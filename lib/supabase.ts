// lib/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage, // persist auth session to device [web:182]
    autoRefreshToken: true, // auto-refresh expired tokens [web:182]
    persistSession: true, // keep session across app restarts [web:182]
  },
});

console.log('SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL); // verify URL [web:240]
console.log('HAS_ANON_KEY', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY); // verify key [web:240]
