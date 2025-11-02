// app/(tabs)/browse-slots.tsx
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, FlatList, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type SlotItem = {
  id: string;
  user_id: string;
  start_at: string;
  end_at: string;
  timezone: string;
  notes: string | null;
  booked_by?: string | null; // joined
  owner_email?: string | null; // joined for display
};

export default function BrowseSlots() {
  const router = useRouter();
  const { effective } = useAppTheme();
  const P = Colors[effective === 'dark' ? 'dark' : 'light'];

  const [userId, setUserId] = useState<string>('');
  const [items, setItems] = useState<SlotItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? '';
      setUserId(uid);
      if (uid) load(uid);
    });
  }, []);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    // 1) Load future slots from others
    const { data: slots, error: slotsErr } = await supabase
      .from('availability_slots')
      .select('id,user_id,start_at,end_at,timezone,notes')
      .gt('end_at', new Date().toISOString())
      .neq('user_id', uid)
      .order('start_at', { ascending: true });
    if (slotsErr) {
      Alert.alert('Error', slotsErr.message);
      setLoading(false);
      return;
    }

    const slotIds = (slots ?? []).map((s) => s.id);

    // 2) Bookings for those slots
    let booked: Record<string, string> = {};
    if (slotIds.length) {
      const { data: bRows, error: bErr } = await supabase
        .from('bookings')
        .select('slot_id,booker_id')
        .in('slot_id', slotIds);
      if (bErr) {
        Alert.alert('Error', bErr.message);
      } else {
        for (const r of bRows ?? []) booked[r.slot_id] = r.booker_id;
      }
    }

    // 3) Owner emails
    const ownerIds = Array.from(new Set((slots ?? []).map((s) => s.user_id)));
    let owners: Record<string, string> = {};
    if (ownerIds.length) {
      const { data: pRows, error: pErr } = await supabase.from('profiles').select('id,email').in('id', ownerIds);
      if (pErr) {
        Alert.alert('Error', pErr.message);
      } else {
        for (const p of pRows ?? []) owners[p.id] = p.email ?? '';
      }
    }

    const merged = (slots ?? []).map((s) => ({
      ...s,
      booked_by: booked[s.id] ?? null,
      owner_email: owners[s.user_id] ?? null,
    })) as SlotItem[];

    setItems(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`browse-slots-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, () => load(userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load(userId))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId, load]);

  const book = (slot: SlotItem) => {
    if (!userId) return;
    Alert.alert(
      'Book this slot?',
      `${new Date(slot.start_at).toLocaleString()} – ${new Date(slot.end_at).toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book',
          onPress: async () => {
            const { error } = await supabase.from('bookings').insert({ slot_id: slot.id, booker_id: userId });
            if (error) {
              Alert.alert('Booking error', error.message);
              return;
            }
            router.push({ pathname: '/meeting', params: { slotId: slot.id } });
          },
        },
      ]
    );
  };

  const cancel = (slot: SlotItem) => {
    Alert.alert('Cancel booking?', 'This will free the slot for others.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          const { data: bRows, error: qErr } = await supabase
            .from('bookings')
            .select('id,booker_id')
            .eq('slot_id', slot.id)
            .limit(1)
            .maybeSingle();
          if (qErr) {
            Alert.alert('Error', qErr.message);
            return;
          }
          if (!bRows?.id) {
            Alert.alert('Not found', 'No booking to cancel.');
            return;
          }
          const { error: dErr } = await supabase.from('bookings').delete().eq('id', bRows.id);
          if (dErr) {
            Alert.alert('Cancel error', dErr.message);
            return;
          }
        },
      },
    ]);
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [items]);

  const renderItem = ({ item }: { item: SlotItem }) => {
    const start = new Date(item.start_at);
    const end = new Date(item.end_at);
    const mine = item.user_id === userId;
    const isBooked = !!item.booked_by;
    const canBook = !mine && !isBooked;
    const canCancel = isBooked && item.booked_by === userId;

    return (
      <View
        style={{
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginBottom: 10,
          backgroundColor: P.card ?? P.background,
          borderColor: P.border,
        }}
      >
        <Text style={{ fontWeight: '600', color: P.text }}>
          {start.toLocaleString()} – {end.toLocaleString()}
        </Text>
        <Text style={{ color: P.mutedText, marginTop: 4 }}>Host: {item.owner_email || item.user_id}</Text>
        {item.notes ? <Text style={{ color: P.mutedText, marginTop: 4 }}>{item.notes}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
          {canBook ? (
            <Button title="Book" onPress={() => book(item)} color={P.tint} />
          ) : isBooked ? (
            <Text style={{ alignSelf: 'center', color: '#FF3B30' }}>Booked {canCancel ? '(you)' : ''}</Text>
          ) : mine ? (
            <Text style={{ alignSelf: 'center', color: P.tabIconDefault }}>Your slot</Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Button
            title="Open meeting"
            onPress={() => router.push({ pathname: '/meeting', params: { slotId: item.id } })}
            color={P.tint}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: P.background }}>
        <Text style={{ color: P.text }}>Loading slots…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: P.background }}>
      <Text style={{ color: P.text, fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Browse & Book</Text>
      <FlatList
        data={sorted}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ color: P.mutedText }}>No upcoming slots from others.</Text>}
        onRefresh={() => userId && load(userId)}
        refreshing={loading}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}
