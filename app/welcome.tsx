// app/welcome.tsx
import { router } from 'expo-router';
import { Button, ScrollView, Text, View } from 'react-native';

export default function Welcome() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>SkillSwap</Text>
        <Text style={{ fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 24 }}>
          Learn and teach skills with your community. Offer what you know, request what you want, and match on overlapping time.
        </Text>
        <View style={{ width: '100%', gap: 10 }}>
          <Text style={{ fontSize: 16, marginBottom: 6 }}>What you can do:</Text>
          <Text>• Create a profile with availability</Text>
          <Text>• Add skills you can teach or want to learn</Text>
          <Text>• Upload proof to verify teaching</Text>
          <Text>• Match on complementary skills and schedule</Text>
          <Text>• Chat to coordinate sessions</Text>
        </View>
        <View style={{ height: 24 }} />
        <Button title="Get started" onPress={() => router.replace('/(auth)/auth')} />
      </View>
    </ScrollView>
  );
}
