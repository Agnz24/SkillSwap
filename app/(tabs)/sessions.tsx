// app/(tabs)/sessions.tsx
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, FlatList, Modal, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Slot = {
  id: string;
  user_id: string;
  start_at: string; // ISO
  end_at: string;   // ISO
  timezone: string;
  notes?: string | null;
  booked_by?: string | null; // derived
};

export default function SessionsScreen() {
  const scheme = useColorScheme();
  const P = Colors[scheme ?? 'light'];

  const [userId, setUserId] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startAt, setStartAt] = useState<string>(''); // "2025-11-01T10:00"
  const [endAt, setEndAt] = useState<string>('');     // "2025-11-01T11:00"
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [notes, setNotes] = useState<string>('');

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? '';
      setUserId(uid);
      if (uid) loadAll(uid);
    });
  }, []);

  const loadAll = useCallback(async (uid: string) => {
    setLoading(true);

    // Load my slots
    const { data: slotsRows, error: slErr } = await supabase
      .from('availability_slots')
      .select('id, user_id, start_at, end_at, timezone, notes')
      .eq('user_id', uid)
      .order('start_at', { ascending: true });
    if (slErr) {
      Alert.alert('Error', slErr.message);
      setLoading(false);
      return;
    }
    const ids = (slotsRows ?? []).map((r) => r.id);

    // Load bookings for these slots
    let booked: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: bRows, error: bErr } = await supabase.from('bookings').select('slot_id, booker_id').in('slot_id', ids);
      if (bErr) {
        Alert.alert('Error', bErr.message);
      } else {
        for (const r of bRows ?? []) booked[r.slot_id] = r.booker_id;
      }
    }

    const withBooking = (slotsRows ?? []).map((r: any) => ({
      ...r,
      booked_by: booked[r.id] ?? null,
    })) as Slot[];

    setSlots(withBooking);
    setLoading(false);
  }, []);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`sessions-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, (p) => {
        const u = (p.new as any)?.user_id ?? (p.old as any)?.user_id;
        if (u === userId) loadAll(userId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadAll(userId);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId, loadAll]);

  const openNew = () => {
    setEditingId(null);
    setStartAt('');
    setEndAt('');
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setNotes('');
    setModalVisible(true);
  };

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  const openEdit = (slot: Slot) => {
    setEditingId(slot.id);
    setStartAt(toLocalInput(slot.start_at));
    setEndAt(toLocalInput(slot.end_at));
    setTimezone(slot.timezone);
    setNotes(slot.notes ?? '');
    setModalVisible(true);
  };

  const saveSlot = async () => {
    if (!userId) return;
    if (!startAt || !endAt) {
      Alert.alert('Missing', 'Please set start and end time.');
      return;
    }
    const startISO = new Date(startAt).toISOString();
    const endISO = new Date(endAt).toISOString();
    if (new Date(endISO) <= new Date(startISO)) {
      Alert.alert('Invalid range', 'End must be after start.');
      return;
    }

    if (!editingId) {
      const { error } = await supabase.from('availability_slots').insert({
        user_id: userId,
        start_at: startISO,
        end_at: endISO,
        timezone,
        notes: notes || null,
      });
      if (error) {
        Alert.alert('Add error', error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('availability_slots')
        .update({ start_at: startISO, end_at: endISO, timezone, notes: notes || null })
        .eq('id', editingId)
        .eq('user_id', userId);
      if (error) {
        Alert.alert('Update error', error.message);
        return;
      }
    }
    setModalVisible(false);
    await loadAll(userId);
  };

  const deleteSlot = async (slotId: string) => {
    Alert.alert('Delete slot?', 'This will remove the slot (and any booking).', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('availability_slots').delete().eq('id', slotId).eq('user_id', userId);
          if (error) {
            Alert.alert('Delete error', error.message);
            return;
          }
          await loadAll(userId);
        },
      },
    ]);
  };

  const sorted = useMemo(() => {
    return [...slots].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [slots]);

  const renderItem = ({ item }: { item: Slot }) => {
    const start = new Date(item.start_at);
    const end = new Date(item.end_at);
    return (
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: P.border,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: P.background,
        }}
      >
        <Text style={{ fontWeight: '600', color: P.text }}>
          {start.toLocaleString()} → {end.toLocaleString()}
        </Text>
        <Text style={{ color: P.mutedText, marginTop: 4 }}>TZ: {item.timezone}</Text>
        {item.notes ? <Text style={{ color: P.mutedText, marginTop: 4 }}>{item.notes}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <Button title="Edit" onPress={() => openEdit(item)} color={P.tint} />
          <Button title="Delete" onPress={() => deleteSlot(item.id)} color="#FF3B30" />
          <View style={{ flex: 1 }} />
          <Text style={{ color: item.booked_by ? '#FF3B30' : P.tint }}>
            {item.booked_by ? 'Booked' : 'Free'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', backgroundColor: P.background }}>
        <Text style={{ color: P.text }}>Loading sessions…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.background }}>
      <FlatList
        data={sorted}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24, color: P.mutedText }}>No slots yet</Text>}
        contentContainerStyle={{ paddingBottom: 96 }}
      />

      {/* Floating Add Button */}
      <View
        style={{
          position: 'absolute',
          right: 16,
          bottom: 24,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <View
          style={{
            backgroundColor: P.tint,
            borderRadius: 28,
            width: 56,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text onPress={openNew} style={{ color: '#FFFFFF', fontSize: 28, lineHeight: 32 }}>
            +
          </Text>
        </View>
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <View
            style={{
              backgroundColor: P.card ?? '#FFF',
              padding: 20,
              borderRadius: 12,
              width: '88%',
              borderColor: P.border,
              borderWidth: 1,
            }}
          >
            <Text style={{ color: P.text, fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              {editingId ? 'Edit Slot' : 'Add Slot'}
            </Text>

            <Text style={{ color: P.text, marginTop: 8, marginBottom: 4 }}>Start</Text>
            <TextInput
              value={startAt}
              onChangeText={setStartAt}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor={P.mutedText}
              autoCapitalize="none"
              style={{
                color: P.text,
                backgroundColor: P.inputBg,
                borderWidth: 1,
                borderColor: P.inputBorder,
                borderRadius: 8,
                padding: 10,
              }}
            />

            <Text style={{ color: P.text, marginTop: 8, marginBottom: 4 }}>End</Text>
            <TextInput
              value={endAt}
              onChangeText={setEndAt}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor={P.mutedText}
              autoCapitalize="none"
              style={{
                color: P.text,
                backgroundColor: P.inputBg,
                borderWidth: 1,
                borderColor: P.inputBorder,
                borderRadius: 8,
                padding: 10,
              }}
            />

            <Text style={{ color: P.text, marginTop: 8, marginBottom: 4 }}>Timezone</Text>
            <TextInput
              value={timezone}
              onChangeText={setTimezone}
              placeholder="e.g., Asia/Kolkata"
              placeholderTextColor={P.mutedText}
              autoCapitalize="none"
              style={{
                color: P.text,
                backgroundColor: P.inputBg,
                borderWidth: 1,
                borderColor: P.inputBorder,
                borderRadius: 8,
                padding: 10,
              }}
            />

            <Text style={{ color: P.text, marginTop: 8, marginBottom: 4 }}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              placeholderTextColor={P.mutedText}
              style={{
                color: P.text,
                backgroundColor: P.inputBg,
                borderWidth: 1,
                borderColor: P.inputBorder,
                borderRadius: 8,
                padding: 10,
                minHeight: 64,
                textAlignVertical: 'top',
              }}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} color={P.tabIconDefault} />
              <Button title="Save" onPress={saveSlot} color={P.tint} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
