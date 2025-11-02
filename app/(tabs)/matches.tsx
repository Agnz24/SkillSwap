// app/(tabs)/matches.tsx
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type MatchRow = {
  other_id: string;
  other_name: string | null;
  other_email: string | null;
  offer_to_them: string[] | null;
  want_from_them: string[] | null;
  first_overlap_weekday: number | null;
  first_overlap_start_min: number | null;
  first_overlap_end_min: number | null;
  overlap_start_at?: string | null;
  overlap_end_at?: string | null;
  _avg?: number | null;
  _count?: number;
};

type RatingRow = {
  user_id: string;
  avg_rating: number | null;
  rating_count: number;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmt = (m: number) => {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
};

export default function Matches() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const P = Colors[colorScheme ?? 'light'];

  const [userId, setUserId] = useState<string>('');
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        Alert.alert('Auth error', error.message);
        setLoading(false);
        return;
      }
      const uid = data.session?.user.id ?? '';
      setUserId(uid);
      if (uid) {
        load(uid);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const load = async (uid: string) => {
    setLoading(true);

    const { data, error } = await supabase.rpc('find_complementary_matches', { p_user: uid });
    if (error) {
      Alert.alert('Load matches error', error.message);
      setLoading(false);
      return;
    }
    const base = (data as MatchRow[]) ?? [];

    // Fetch ratings for all matched users in one query
    const ids = Array.from(new Set(base.map((r) => r.other_id)));
    let rMap = new Map<string, RatingRow>();
    if (ids.length) {
      const { data: rData, error: rErr } = await supabase
        .from('user_ratings')
        .select('user_id, avg_rating, rating_count')
        .in('user_id', ids);
      if (!rErr && rData) {
        rMap = new Map((rData as RatingRow[]).map((r) => [r.user_id, r]));
      }
    }

    const withRatings: MatchRow[] = base.map((r) => {
      const rr = rMap.get(r.other_id);
      return {
        ...r,
        _avg: rr?.avg_rating ?? null,
        _count: rr?.rating_count ?? 0,
      };
    });

    setRows(withRatings);
    setLoading(false);
  };

  const ensureChat = async (otherId: string, label?: string | null) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed?.session?.user?.id) {
          Alert.alert('Not authenticated', 'Please sign in again');
          return;
        }
      }

      const { data, error } = await supabase.rpc('get_or_create_thread', { p_other: otherId });
      if (error) throw error;

      const threadId = data as string;
      router.push({ pathname: '/chat', params: { threadId, otherId, label: label ?? '' } });
    } catch (e: any) {
      Alert.alert('Chat error', e.message ?? String(e));
    }
  };

  const renderItem = ({ item }: { item: MatchRow }) => {
    const hasOverlapMins =
      item.first_overlap_weekday != null &&
      item.first_overlap_start_min != null &&
      item.first_overlap_end_min != null;

    const title =
      item.other_email && typeof item.other_email === 'string' && item.other_email.trim().length > 0
        ? item.other_email
        : item.other_name && typeof item.other_name === 'string' && item.other_name.trim().length > 0
        ? item.other_name
        : item.other_id;

    const hasTimestamps = !!item.overlap_start_at && !!item.overlap_end_at;

    const ratingText =
      item._avg != null ? `${Number(item._avg).toFixed(1)}${item._count ? ` (${item._count})` : ''}` : '—';

    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: P.border,
          backgroundColor: P.card ?? P.background,
          borderRadius: 8,
          padding: 12,
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontWeight: '600', color: P.text }}>{title}</Text>
          <Text style={{ color: P.mutedText }}>{ratingText}</Text>
        </View>
        <Text style={{ color: P.text }}>Teach: {(item.offer_to_them ?? []).join(', ')}</Text>
        <Text style={{ color: P.text }}>Learn: {(item.want_from_them ?? []).join(', ')}</Text>
        <Text style={{ color: P.mutedText }}>
          {hasTimestamps
            ? `First overlap: ${new Date(item.overlap_start_at as string).toLocaleString()} – ${new Date(
                item.overlap_end_at as string
              ).toLocaleString()}`
            : hasOverlapMins
            ? `First overlap: ${WEEKDAYS[item.first_overlap_weekday!]} ${fmt(
                item.first_overlap_start_min!
              )}–${fmt(item.first_overlap_end_min!)}`
            : 'No overlapping time yet'}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Button title="Open chat" onPress={() => ensureChat(item.other_id, title)} color={P.tint} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: P.background }}>
        <Text style={{ color: P.text }}>Loading matches…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: P.background }}>
      <Text style={{ color: P.text, fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Matches</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.other_id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ color: P.mutedText }}>No matches yet. Add complementary Offers/Wants and overlapping availability.</Text>}
        refreshing={loading}
        onRefresh={() => userId && load(userId)}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}
