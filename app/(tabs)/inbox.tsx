// app/(tabs)/inbox.tsx
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type ThreadPreview = {
  thread_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar?: string | null;
  last_message: string | null;
  last_timestamp: string | null; // ISO string
  unread_count: number;
};

export default function InboxScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const P = Colors[scheme ?? 'light'];

  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [threads, setThreads] = useState<ThreadPreview[]>([]);

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        Alert.alert('Auth error', error.message);
        return;
      }
      const uid = data.session?.user.id ?? '';
      setUserId(uid);
    });
  }, []);

  // Load previews via SELECTs plus unread via RPC
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    // 1) Fetch threads where current user is a participant
    const { data: tRows, error: tErr } = await supabase
      .from('threads')
      .select('id, user_a, user_b')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);
    if (tErr) {
      Alert.alert('Load inbox error', tErr.message);
      setLoading(false);
      return;
    }
    const threadIds = (tRows ?? []).map((t) => t.id as string);
    if (threadIds.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    // 2) Fetch recent messages
    const { data: mRows, error: mErr } = await supabase
      .from('messages')
      .select('id, thread_id, sender_id, content, created_at, read_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (mErr) {
      Alert.alert('Load inbox error', mErr.message);
      setLoading(false);
      return;
    }

    // pick most recent per thread
    const latestByThread = new Map<string, any>();
    for (const m of mRows ?? []) {
      if (!latestByThread.has(m.thread_id)) latestByThread.set(m.thread_id, m);
    }

    // 3) compute unread per thread (incoming, unread)
    const unreadByThread = new Map<string, number>();
    for (const m of mRows ?? []) {
      if (m.sender_id !== userId && !m.read_at) {
        unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
      }
    }

    // 4) names from profiles (optional)
    const otherIds = Array.from(
      new Set(
        (tRows ?? []).map((t: any) => (t.user_a === userId ? t.user_b : t.user_a)).filter(Boolean)
      )
    );
    let nameById: Record<string, string> = {};
    if (otherIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', otherIds);
      for (const p of profs ?? []) {
        nameById[p.id] = p.display_name || p.email || p.id.slice(0, 8);
      }
    }

    // 5) Compose preview rows
    const previews: ThreadPreview[] = (tRows ?? []).map((t: any) => {
      const other_user_id = t.user_a === userId ? t.user_b : t.user_a;
      const lm = latestByThread.get(t.id);
      return {
        thread_id: t.id,
        other_user_id,
        other_user_name: nameById[other_user_id] ?? (other_user_id?.slice(0, 8) ?? 'User'),
        other_user_avatar: null,
        last_message: lm?.content ?? null,
        last_timestamp: lm?.created_at ?? null,
        unread_count: unreadByThread.get(t.id) ?? 0,
      };
    });

    setThreads(previews);
    setLoading(false);
  }, [userId]);

  // Initial and subsequent loads
  useEffect(() => {
    load();
  }, [load]);

  // Realtime refresh
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`inbox-sync-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const sorted = useMemo(() => {
    return [...threads].sort((a, b) => {
      const at = a.last_timestamp ? Date.parse(a.last_timestamp) : 0;
      const bt = b.last_timestamp ? Date.parse(b.last_timestamp) : 0;
      return bt - at;
    });
  }, [threads]);

  const openThread = (threadId: string, otherUserId: string, otherName: string) => {
    router.push({ pathname: '/chat', params: { threadId, otherId: otherUserId, label: otherName } });
  };

  const renderItem = ({ item }: { item: ThreadPreview }) => {
    const hasUnread = item.unread_count > 0;
    return (
      <Pressable
        onPress={() => openThread(item.thread_id, item.other_user_id, item.other_user_name)}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: P.border,
          backgroundColor: P.background,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: P.card ?? '#F0F0F0',
              marginRight: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: P.border,
            }}
          >
            <Text style={{ fontWeight: '600', color: P.text }}>
              {item.other_user_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text
                style={{ fontWeight: '600', fontSize: 16, color: P.text }}
                numberOfLines={1}
              >
                {item.other_user_name || 'Unknown'}
              </Text>
              {item.last_timestamp ? (
                <Text style={{ color: P.mutedText, marginLeft: 8 }}>
                  {new Date(item.last_timestamp).toLocaleTimeString()}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, alignItems: 'center' }}>
              <Text style={{ color: P.mutedText, flex: 1 }} numberOfLines={1}>
                {item.last_message ?? 'No messages yet'}
              </Text>
              {hasUnread ? (
                <View
                  style={{
                    marginLeft: 8,
                    backgroundColor: '#FF3B30',
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    minWidth: 20,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 12 }}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', backgroundColor: P.background }}>
        <Text style={{ color: P.text }}>Loading inbox…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.background }}>
      <FlatList
        data={sorted}
        keyExtractor={(t) => t.thread_id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 24, color: P.mutedText }}>
            No conversations yet
          </Text>
        }
      />
    </View>
  );
}
