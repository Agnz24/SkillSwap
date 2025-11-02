// app/(tabs)/profile.tsx
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Profile = {
  id: string;
  display_name: string;
  email: string;
  bio?: string;
};

type Skill = {
  id: string; // stored as text here; DB may be bigint
  title: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { effective } = useAppTheme();

  // palette
  const P = effective === 'dark' ? Colors.dark : Colors.light;

  const [userId, setUserId] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [offers, setOffers] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number>(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? '';
      setUserId(uid);
    });
  }, []);

  const loadProfileOnly = useCallback(async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (error) {
      Alert.alert('Load profile error', error.message);
      setLoading(false);
      return;
    }
    const p = data as Profile;
    setProfile(p);
    setName(p.display_name ?? '');
    setBio(p.bio ?? '');
    setLoading(false);
  }, []);

  const loadSkillsSummary = useCallback(async (uid: string) => {
    const { data: allSkills, error: skillErr } = await supabase.from('skills').select('*').order('title', { ascending: true });
    if (skillErr) {
      Alert.alert('Load skills error', skillErr.message);
      return;
    }
    const skillsArr = (allSkills as Skill[]) ?? [];
    setSkills(skillsArr);

    const { data: offerData, error: offerErr } = await supabase.from('user_offers').select('skill_id').eq('user_id', uid);
    if (offerErr) {
      Alert.alert('Load offers error', offerErr.message);
      return;
    }
    const offerIds = (offerData as any[] | null)?.map((o) => String(o.skill_id)) ?? [];
    const offerTitles = skillsArr.filter((s) => offerIds.includes(String(s.id))).map((s) => s.title);
    setOffers(offerTitles);

    const { data: wantData, error: wantErr } = await supabase.from('user_wants').select('skill_id').eq('user_id', uid);
    if (wantErr) {
      Alert.alert('Load wants error', wantErr.message);
      return;
    }
    const wantIds = (wantData as any[] | null)?.map((w) => String(w.skill_id)) ?? [];
    const wantTitles = skillsArr.filter((s) => wantIds.includes(String(s.id))).map((s) => s.title);
    setWants(wantTitles);
  }, []);

  const loadRatings = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('session_feedback').select('rating').eq('ratee_id', uid);
    if (error) {
      console.log('rating load error', error);
      return;
    }
    const ratings = (data ?? []).map((r) => r.rating).filter((v) => typeof v === 'number');
    const count = ratings.length;
    setRatingCount(count);
    setAvgRating(count ? ratings.reduce((a, b) => a + b, 0) / count : null);
  }, []);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    await Promise.all([loadProfileOnly(userId), loadSkillsSummary(userId), loadRatings(userId)]);
  }, [userId, loadProfileOnly, loadSkillsSummary, loadRatings]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        loadSkillsSummary(userId);
        loadRatings(userId);
      }
    }, [userId, loadSkillsSummary, loadRatings])
  );

  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel(`profile-live-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_offers' }, (p) => {
        if ((p.new as any)?.user_id === userId) loadSkillsSummary(userId);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'user_offers' }, (p) => {
        if ((p.old as any)?.user_id === userId) loadSkillsSummary(userId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_wants' }, (p) => {
        if ((p.new as any)?.user_id === userId) loadSkillsSummary(userId);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'user_wants' }, (p) => {
        if ((p.old as any)?.user_id === userId) loadSkillsSummary(userId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'skills' }, () => {
        loadSkillsSummary(userId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_feedback' }, (p) => {
        const affected = (p.new as any)?.ratee_id ?? (p.old as any)?.ratee_id;
        if (affected === userId) loadRatings(userId);
      })
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [userId, loadSkillsSummary, loadRatings]);

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ display_name: name, bio }).eq('id', userId);
    if (error) {
      Alert.alert('Save profile error', error.message);
      setSaving(false);
      return;
    }
    Alert.alert('Success', 'Profile updated');
    setSaving(false);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/auth');
    } catch (e: any) {
      Alert.alert('Sign out error', e.message ?? String(e));
    }
  };

  if (loading && !profile) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: P.background }}>
        <Text style={{ color: P.text }}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: P.background }}>
      <Text style={{ color: P.text, fontSize: 20, fontWeight: '600', marginBottom: 16 }}>Profile</Text>

      <Text style={{ color: P.text, fontWeight: '600', marginBottom: 4 }}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your display name"
        placeholderTextColor={P.mutedText}
        style={{
          color: P.text,
          backgroundColor: P.inputBg,
          borderColor: P.inputBorder,
          borderWidth: 1,
          borderRadius: 8,
          padding: 8,
          marginBottom: 12,
        }}
      />

      <Text style={{ color: P.text, fontWeight: '600', marginBottom: 4 }}>Email</Text>
      <Text
        style={{
          color: P.text,
          backgroundColor: P.inputBg,
          borderColor: P.inputBorder,
          borderWidth: 1,
          padding: 8,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        {profile?.email}
      </Text>

      <Text style={{ color: P.text, fontWeight: '600', marginBottom: 4 }}>Bio</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        placeholder="Tell others about yourself"
        placeholderTextColor={P.mutedText}
        multiline
        numberOfLines={4}
        style={{
          color: P.text,
          backgroundColor: P.inputBg,
          borderColor: P.inputBorder,
          borderWidth: 1,
          borderRadius: 8,
          padding: 8,
          marginBottom: 12,
          textAlignVertical: 'top',
        }}
      />

      <Button title={saving ? 'Saving…' : 'Save Profile'} onPress={saveProfile} disabled={saving} color={P.tint} />

      <Text style={{ color: P.text, fontWeight: '600', marginTop: 20, marginBottom: 8 }}>Your Skills</Text>
      <Text style={{ color: P.mutedText, marginBottom: 4 }}>Teach: {offers.join(', ') || 'None yet'}</Text>
      <Text style={{ color: P.mutedText, marginBottom: 12 }}>Learn: {wants.join(', ') || 'None yet'}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Manage Skills" onPress={() => router.push('/(tabs)/skills')} color={P.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Book Session" onPress={() => router.push('/(tabs)/sessions')} color={P.tint} />
        </View>
      </View>

      <Text style={{ color: P.text, fontWeight: '600', marginTop: 20, marginBottom: 8 }}>Your Rating</Text>
      <Text style={{ color: P.text }}>
        {avgRating ? `${avgRating.toFixed(1)} / 5` : '—'} {ratingCount ? `(${ratingCount})` : ''}
      </Text>

      <View style={{ marginTop: 20 }}>
        <Button title="Sign Out" color="#FF3B30" onPress={logout} />
      </View>
    </ScrollView>
  );
}
