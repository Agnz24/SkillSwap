import type { ExpoConfig } from '@expo/config';
import 'dotenv/config';

const config: ExpoConfig = {
name: 'SkillSwap',
slug: 'skillswap',
scheme: 'skillswap',
version: '1.0.0',
ios: { bundleIdentifier: 'com.yourname.skillswap' },
android: { package: 'com.yourname.skillswap', versionCode: 1, permissions: [] },
extra: {
SUPABASE_URL: process.env.SUPABASE_URL || 'https://ztnpqdefopmqalhmtrzp.supabase.co',
SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
eas: {
projectId: '3a27c5c1-fc26-461e-bb41-aebc1972e81c'
}
}
};

export default config;