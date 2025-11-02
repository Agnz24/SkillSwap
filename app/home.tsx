// app/home.tsx
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

type Skill = { id: number; title: string };
type OfferWantRow = { user_id: string; skill_id: number; skills: Skill | null };
type Slot = { id: number; weekday: number; start_min: number; end_min: number; timezone: string };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Convert "HH:MM" to minutes since midnight
const hhmmToMinutes = (hhmm: string) => {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
};

// Convert minutes to "HH:MM"
const minutesToHHMM = (min: number) => {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

export default function Home() {
  const [userId, setUserId] = useState<string>('');

  // Lists
  const [offers, setOffers] = useState<OfferWantRow[]>([]);
  const [wants, setWants] = useState<OfferWantRow[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  // Inputs
  const [offerTitle, setOfferTitle] = useState('');
  const [wantTitle, setWantTitle] = useState('');
  const [weekday, setWeekday] = useState<number>(1); // Mon default
  const [startHHMM, setStartHHMM] = useState('18:00');
  const [endHHMM, setEndHHMM] = useState('20:00');
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        Alert.alert('Auth error', error.message);
        return;
      }
      const uid = data.session?.user.id ?? '';
      setUserId(uid);
      if (uid) void loadAll(uid);
    });
  }, []);

  const loadAll = async (uid: string) => {
    // Offers
    {
      const { data, error } = await supabase
        .from('user_offers')
        .select('user_id, skill_id, skills:skill_id (id, title)')
        .eq('user_id', uid);
      if (error) Alert.alert('Load offers error', error.message);
      setOffers((data as OfferWantRow[] | null) ?? []);
    }

    // Wants
    {
      const { data, error } = await supabase
        .from('user_wants')
        .select('user_id, skill_id, skills:skill_id (id, title)')
        .eq('user_id', uid);
      if (error) Alert.alert('Load wants error', error.message);
      setWants((data as OfferWantRow[] | null) ?? []);
    }

    // Availability
    {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('id, weekday, start_min, end_min, timezone')
        .eq('user_id', uid)
        .order('weekday', { ascending: true });
      if (error) Alert.alert('Load slots error', error.message);
      setSlots((data as Slot[] | null) ?? []);
    }
  };

  // Find or create a skill by title
  const getOrCreateSkillByTitle = async (title: string) => {
    const clean = title.trim();
    if (!clean) {
      Alert.alert('Missing title', 'Type a skill name first.');
      return null;
    }

    // Try to find by case-insensitive match (exact string)
    const { data: found, error: findErr } = await supabase
      .from('skills')
      .select('id')
      .ilike('title', clean)
      .limit(1)
      .maybeSingle();
    if (findErr) {
      Alert.alert('Skill lookup error', findErr.message);
      return null;
    }
    if (found?.id) return found.id;

    // Create new
    const { data: created, error: createErr } = await supabase
      .from('skills')
      .insert({ title: clean, description: '', tags: [] })
      .select('id')
      .single();
    if (createErr) {
      Alert.alert('Create skill error', createErr.message);
      return null;
    }
    return created.id as number;
  };

  // Offer handlers
  const onAddOffer = async () => {
    if (!userId) return;
    const skillId = await getOrCreateSkillByTitle(offerTitle);
    if (!skillId) return;
    const { error } = await supabase.from('user_offers').insert({ user_id: userId, skill_id: skillId });
    if (error) return Alert.alert('Add offer error', error.message);
    setOfferTitle('');
    void loadAll(userId);
  };

  const onRemoveOffer = async (skillId: number) => {
    const { error } = await supabase.from('user_offers').delete().match({ user_id: userId, skill_id });
    if (error) return Alert.alert('Remove offer error', error.message);
    void loadAll(userId);
  };

  // Want handlers
  const onAddWant = async () => {
    if (!userId) return;
    const skillId = await getOrCreateSkillByTitle(wantTitle);
    if (!skillId) return;
    const { error } = await supabase.from('user_wants').insert({ user_id: userId, skill_id: skillId });
    if (error) return Alert.alert('Add want error', error.message);
    setWantTitle('');
    void loadAll(userId);
  };

  const onRemoveWant = async (skillId: number) => {
    const { error } = await supabase.from('user_wants').delete().match({ user_id: userId, skill_id });
    if (error) return Alert.alert('Remove want error', error.message);
    void loadAll(userId);
  };

  // Availability handlers
  const onAddSlot = async () => {
    if (!userId) return;
    const s = hhmmToMinutes(startHHMM);
    const e = hhmmToMinutes(endHHMM);
    if (s == null || e == null) return Alert.alert('Invalid time', 'Use HH:MM like 18:00.');
    if (e <= s) return Alert.alert('Invalid range', 'End time must be after start time.');
    const { error } = await supabase.from('availability_slots').insert({
      user_id: userId,
      weekday,
      start_min: s,
      end_min: e,
      timezone,
    });
    if (error) return Alert.alert('Add slot error', error.message);
    void loadAll(userId);
  };

  const onRemoveSlot = async (id: number) => {
    const { error } = await supabase.from('availability_slots').delete().eq('id', id).eq('user_id', userId);
    if (error) return Alert.alert('Remove slot error', error.message);
    void loadAll(userId);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Offered Skills */}
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Your Offered Skills</Text>
      <FlatList
        data={offers}
        keyExtractor={(item) => `${item.skill_id}`}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text>{item.skills?.title ?? 'Unknown skill'}</Text>
            <Button title="Remove" onPress={() => onRemoveOffer(item.skill_id)} />
          </View>
        )}
        ListEmptyComponent={<Text>No offered skills yet.</Text>}
        scrollEnabled={false}
      />
      <Text style={{ fontSize: 16, marginTop: 12, marginBottom: 6 }}>Add an Offered Skill</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <TextInput
          placeholder="Type a skill (e.g., Python)"
          value={offerTitle}
          onChangeText={setOfferTitle}
          style={{ flex: 1, borderWidth: 1, padding: 10, borderRadius: 6 }}
          autoCapitalize="none"
        />
        <Button title="Add Offer" onPress={onAddOffer} />
      </View>

      {/* Wanted Skills */}
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Your Wanted Skills</Text>
      <FlatList
        data={wants}
        keyExtractor={(item) => `${item.skill_id}`}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text>{item.skills?.title ?? 'Unknown skill'}</Text>
            <Button title="Remove" onPress={() => onRemoveWant(item.skill_id)} />
          </View>
        )}
        ListEmptyComponent={<Text>No wanted skills yet.</Text>}
        scrollEnabled={false}
      />
      <Text style={{ fontSize: 16, marginTop: 12, marginBottom: 6 }}>Add a Wanted Skill</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <TextInput
          placeholder="Type a skill (e.g., Guitar)"
          value={wantTitle}
          onChangeText={setWantTitle}
          style={{ flex: 1, borderWidth: 1, padding: 10, borderRadius: 6 }}
          autoCapitalize="none"
        />
        <Button title="Add Want" onPress={onAddWant} />
      </View>

      {/* Availability */}
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Your Availability</Text>
      <FlatList
        data={slots}
        keyExtractor={(s) => `${s.id}`}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text>
              {WEEKDAYS[item.weekday]} {minutesToHHMM(item.start_min)}–{minutesToHHMM(item.end_min)} ({item.timezone})
            </Text>
            <Button title="Remove" onPress={() => onRemoveSlot(item.id)} />
          </View>
        )}
        ListEmptyComponent={<Text>No time slots yet.</Text>}
        scrollEnabled={false}
      />
      <Text style={{ fontSize: 16, marginTop: 12, marginBottom: 6 }}>Add Availability</Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {/* Weekday picker */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEEKDAYS.map((d, idx) => (
            <TouchableOpacity
              key={d}
              onPress={() => setWeekday(idx)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderRadius: 6,
                backgroundColor: weekday === idx ? '#ddd' : 'transparent',
              }}
            >
              <Text>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            placeholder="Start HH:MM"
            value={startHHMM}
            onChangeText={setStartHHMM}
            style={{ flex: 1, borderWidth: 1, padding: 10, borderRadius: 6 }}
            autoCapitalize="none"
            inputMode="numeric"
          />
          <TextInput
            placeholder="End HH:MM"
            value={endHHMM}
            onChangeText={setEndHHMM}
            style={{ flex: 1, borderWidth: 1, padding: 10, borderRadius: 6 }}
            autoCapitalize="none"
            inputMode="numeric"
          />
        </View>
        <TextInput
          placeholder="Timezone (e.g., UTC)"
          value={timezone}
          onChangeText={setTimezone}
          style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}
          autoCapitalize="characters"
        />
        <Button title="Add Slot" onPress={onAddSlot} />
      </View>
    </ScrollView>
  );
}
