SkillSwap — Skill‑barter mobile app (Expo + Supabase)
SkillSwap is a barter‑inspired mobile app where users exchange skills by teaching and learning without money, featuring authentication, profiles, skills (offer/want), real‑time availability, and one‑tap booking.​

Features
Email/password authentication and session‑aware navigation that avoids cold‑start blank screens on Android/iOS.​

Profile with display name/bio, skills offered and wanted, and live rating aggregation.​

Real‑time availability slots and bookings synced via Supabase Realtime; “Browse & Book” with one‑tap book/cancel.​

Themed UI with system light/dark support and consistent styling across tabs, inputs, and lists.​

Shareable live demo via Expo Go Tunnel for zero‑cost testing.​

Tech stack
React Native (Expo 54), Expo Router, TypeScript, React Navigation, Reanimated, Gesture Handler.​

Supabase: Auth, Postgres (RLS), Realtime channels for live updates.​

Project structure
app/ — Expo Router file‑based navigation (tabs, auth, profile, browse & book, inbox).​

theme/ — useAppTheme hook and centralized Colors palette.​

lib/supabase.ts — Supabase client setup and helpers.​

components/ — Reusable UI (lists, badges, forms) and hooks (useUnreadCount, subscriptions).​

Getting started
Prerequisites

Node.js LTS, Git, and the Expo CLI (npx expo).​

Install Expo Go on your phone (iOS App Store / Google Play).​

Install

npm install.​

Environment

Create a .env file at the project root based on .env.example:​

SUPABASE_URL=https://YOURPROJECT.supabase.co.​

SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY.​

The app reads values via Constants.expoConfig.extra when running with app.config.ts.​

Run (live demo via Expo Go)

npx expo start --tunnel.​

Scan the QR with Expo Go (Android scanner inside app; iOS Camera works too), or click “Open in Expo Go” from the web DevTools.​

Keep the terminal open; closing it stops the live link.​

Key flows
Auth: Email/password sign‑in/sign‑up; session is restored before navigation to prevent blank screens.​

Skills: Users mark skills they offer and want; lists react to Supabase changes in real time.​

Browse & Book: Lists upcoming availability from others; book/cancel in one tap; UI updates instantly from Realtime.​

Profile & Ratings: Edit profile; average rating computed from feedback, updated live.​

Inbox badge: Unread count hook with capped display (“99+”).​

Configuration notes
No secrets in source control; .env is ignored by Git and an example file is provided.​

If you later build APKs, increment android.versionCode and manage secrets with EAS; not required for Expo Go usage.​

Troubleshooting
Android blank page after QR: use --tunnel, clear caches (npx expo start -c), ensure session‑aware route guards.​

Tunnel not opening for a tester: update Expo Go, use the clickable “Open in Expo Go” link, or restart with --port 8083
