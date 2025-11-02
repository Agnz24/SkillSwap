// app/(tabs)/skills.tsx
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Modal, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Skill = {
  id: string;
  title: string;
};

type SkillSelection = {
  skill: Skill;
  isOffer: boolean;
  isWant: boolean;
  isVerified: boolean; // proof present
};

const DEFAULT_BUCKET = 'proofs';

async function uuidV4(): Promise<string> {
  // Prefer Expo's randomUUID if available
  // @ts-ignore
  if (typeof Crypto.randomUUID === 'function') {
    // @ts-ignore
    return Crypto.randomUUID() as string;
  }
  const bytes = await Crypto.getRandomBytesAsync(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hex = Array.from(bytes, toHex).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function SkillsScreen() {
  const scheme = useColorScheme();
  const P = Colors[scheme ?? 'light'];

  const [userId, setUserId] = useState<string>('');
  const [skills, setSkills] = useState<SkillSelection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [bucketId, setBucketId] = useState<string>(DEFAULT_BUCKET);

  // On mount: resolve session, silently pick a bucket if available
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id ?? '';
      setUserId(uid);

      try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (!error) {
          const names = (buckets ?? []).map((b: any) => b.name);
          if (names.includes(DEFAULT_BUCKET)) {
            setBucketId(DEFAULT_BUCKET);
          } else if (names.length > 0) {
            setBucketId(names[0]); // silent fallback
          }
        }
      } catch {}

      if (uid) {
        loadSkills(uid);
      }
    });
  }, []);

  const loadSkills = async (uid: string) => {
    setLoading(true);

    const { data: allSkills, error: skillErr } = await supabase
      .from('skills')
      .select('*', { count: 'exact', head: false })
      .order('title', { ascending: true });

    if (skillErr) {
      Alert.alert('Load skills error', skillErr.message);
      setLoading(false);
      return;
    }

    const { data: offerData } = await supabase.from('user_offers').select('skill_id').eq('user_id', uid);
    const offerIds = new Set((offerData as any[] | null)?.map((o) => String(o.skill_id)) ?? []);

    const { data: wantData } = await supabase.from('user_wants').select('skill_id').eq('user_id', uid);
    const wantIds = new Set((wantData as any[] | null)?.map((w) => String(w.skill_id)) ?? []);

    const { data: proofs } = await supabase
      .from('skill_proofs')
      .select('skill_id')
      .eq('user_id', uid)
      .eq('status', 'approved');

    const verified = new Set<string>((proofs ?? []).map((p: any) => String(p.skill_id)));

    const selections: SkillSelection[] = (allSkills as Skill[]).map((skill) => ({
      skill,
      isOffer: offerIds.has(String(skill.id)),
      isWant: wantIds.has(String(skill.id)),
      isVerified: verified.has(String(skill.id)),
    }));

    setSkills([...selections]);
    setLoading(false);
  };

  const openAddModal = () => {
    setModalMode('add');
    setEditingSkill(null);
    setInputValue('');
    setModalVisible(true);
  };

  const openEditModal = (skill: Skill) => {
    setModalMode('edit');
    setEditingSkill(skill);
    setInputValue(skill.title);
    setModalVisible(true);
  };

  const deleteSkill = async (skillId: string) => {
    Alert.alert('Delete skill', 'Are you sure you want to delete this skill?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('skills').delete().eq('id', skillId);
          if (error) {
            Alert.alert('Delete error', error.message);
            return;
          }
          setSkills((prev) => prev.filter((s) => s.skill.id !== skillId));
        },
      },
    ]);
  };

  const saveSkill = async () => {
    if (!inputValue.trim()) {
      Alert.alert('Error', 'Skill name cannot be empty');
      return;
    }

    try {
      if (modalMode === 'add') {
        const { data, error } = await supabase.from('skills').insert({ title: inputValue.trim() }).select().single();
        if (error) throw error;

        setSkills((prev) => [{ skill: data as Skill, isOffer: false, isWant: false, isVerified: false }, ...prev]);
        Alert.alert('Success', 'Skill added');
      } else if (modalMode === 'edit' && editingSkill) {
        const { data, error } = await supabase
          .from('skills')
          .update({ title: inputValue.trim() })
          .eq('id', editingSkill.id)
          .select()
          .maybeSingle();
        if (error) throw error;

        if (data) {
          setSkills((prev) => prev.map((s) => (s.skill.id === (data as Skill).id ? { ...s, skill: data as Skill } : s)));
          Alert.alert('Success', 'Skill updated');
        } else {
          await loadSkills(userId);
          Alert.alert('Updated', 'Skill updated (reloaded)');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setModalVisible(false);
      setInputValue('');
      setEditingSkill(null);
    }
  };

  // Require proof before enabling Teach
  const ensureProofThenOffer = async (skillId: string) => {
    const row = skills.find((s) => s.skill.id === skillId);
    const alreadyVerified = row?.isVerified;

    let verified = alreadyVerified;
    if (!verified) {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const file = picked.assets[0];
      const ext = (file.name?.split('.').pop() || 'pdf').toLowerCase();

      const id = await uuidV4();
      const path = `${userId}/${skillId}/${id}.${ext}`;

      const ab = await fetch(file.uri).then((r) => r.arrayBuffer());

      const up = await supabase.storage.from(bucketId).upload(path, ab, {
        upsert: false,
        contentType: file.mimeType || 'application/octet-stream',
      });
      if (up.error) {
        Alert.alert('Upload error', up.error.message);
        return;
      }

      const storage_path = `${bucketId}/${path}`;
      const ins = await supabase.from('skill_proofs').insert({
        user_id: userId,
        skill_id: skillId,
        storage_path,
        status: 'approved',
      });
      if (ins.error) {
        Alert.alert('Save error', ins.error.message);
        return;
      }

      verified = true;
      setSkills((prev) => prev.map((s) => (s.skill.id === skillId ? { ...s, isVerified: true } : s)));
    }

    const { error } = await supabase.from('user_offers').insert({ user_id: userId, skill_id: skillId });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setSkills((prev) => prev.map((s) => (s.skill.id === skillId ? { ...s, isOffer: true } : s)));
    Alert.alert('Success', 'Teaching enabled for this skill.');
  };

  const toggleOffer = async (skillId: string, currentState: boolean) => {
    if (currentState) {
      const { error } = await supabase.from('user_offers').delete().eq('user_id', userId).eq('skill_id', skillId);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setSkills((prev) => prev.map((s) => (s.skill.id === skillId ? { ...s, isOffer: false } : s)));
    } else {
      await ensureProofThenOffer(skillId);
    }
  };

  const toggleWant = async (skillId: string, currentState: boolean) => {
    if (currentState) {
      const { error } = await supabase.from('user_wants').delete().eq('user_id', userId).eq('skill_id', skillId);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('user_wants').insert({ user_id: userId, skill_id: skillId });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
    }
    setSkills((prev) => prev.map((s) => (s.skill.id === skillId ? { ...s, isWant: !currentState } : s)));
  };

  const renderItem = ({ item }: { item: SkillSelection }) => (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: P.border,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: P.background,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontWeight: '600', fontSize: 16, flex: 1, color: P.text }}>{item.skill.title}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button title="Edit" onPress={() => openEditModal(item.skill)} color={P.tint} />
          <Button title="Delete" onPress={() => deleteSkill(item.skill.id)} color="#FF3B30" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title={item.isOffer ? 'Teaching ✓' : 'Teach'}
          onPress={() => toggleOffer(item.skill.id, item.isOffer)}
          color={item.isOffer ? P.tint : P.tabIconDefault}
        />
        <Button
          title={item.isWant ? 'Learning ✓' : 'Learn'}
          onPress={() => toggleWant(item.skill.id, item.isWant)}
          color={item.isWant ? P.tint : P.tabIconDefault}
        />
      </View>
      {item.isOffer && !item.isVerified ? (
        <Text style={{ color: '#d00', marginTop: 6 }}>
          Proof required: upload a document to keep this skill in Teaching.
        </Text>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', backgroundColor: P.background }}>
        <Text style={{ color: P.text }}>Loading skills…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.background }}>
      <FlatList
        contentContainerStyle={{ paddingBottom: 96 }}
        data={skills}
        keyExtractor={(s) => s.skill.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: P.mutedText }}>No skills yet. Add one!</Text>}
        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
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
          <Text onPress={openAddModal} style={{ color: '#FFFFFF', fontSize: 28, lineHeight: 32 }}>
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
              width: '85%',
              borderColor: P.border,
              borderWidth: 1,
            }}
          >
            <Text style={{ color: P.text, fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
              {modalMode === 'add' ? 'Add New Skill' : 'Edit Skill'}
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Skill name"
              placeholderTextColor={P.mutedText}
              style={{
                color: P.text,
                backgroundColor: P.inputBg,
                borderWidth: 1,
                borderColor: P.inputBorder,
                borderRadius: 8,
                padding: 10,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} color={P.tabIconDefault} />
              <Button title="Save" onPress={saveSkill} color={P.tint} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
