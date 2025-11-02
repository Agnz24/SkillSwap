// components/ProofUpload.tsx
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Button } from 'react-native';
import { supabase } from '../lib/supabase';

export function ProofUpload({ userId, skillId, onUploaded }: { userId: string; skillId: number; onUploaded: () => void }) {
  const pickAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const fileExt = (file.name?.split('.').pop() || 'pdf').toLowerCase();
      const path = `${userId}/${skillId}/${crypto.randomUUID()}.${fileExt}`; // in 'proofs' bucket

      const fileData = await fetch(file.uri).then(r => r.blob());

      const { error: upErr } = await supabase.storage.from('proofs').upload(path, fileData, {
        upsert: false,
        contentType: file.mimeType || 'application/octet-stream',
      });
      if (upErr) {
        Alert.alert('Upload error', upErr.message); // [web:12]
        return;
      }

      const storagePath = `proofs/${path}`;
      const { error: dbErr } = await supabase.from('skill_proofs').insert({
        user_id: userId,
        skill_id: skillId,
        storage_path: storagePath,
        status: 'approved', // or 'pending' if you add manual review
      });
      if (dbErr) {
        Alert.alert('Save error', dbErr.message); // [web:12]
        return;
      }

      Alert.alert('Uploaded', 'Proof uploaded successfully.');
      onUploaded();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    }
  };

  return <Button title="Upload proof" onPress={pickAndUpload} />;
}
