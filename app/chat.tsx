// app/chat.tsx
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, FlatList, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

type Msg = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null; // optional if present
};

export default function ChatScreen() {
  const { threadId, otherId, label } = useLocalSearchParams<{
    threadId?: string;
    otherId?: string;
    label?: string;
  }>();

  const [me, setMe] = useState<string>('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setMe(data.session?.user.id ?? '');
    });
  }, []);

  const scrollToEnd = () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) {
      Alert.alert('Load messages error', error.message);
      setLoading(false);
      return;
    }
    setMsgs((data as Msg[]) ?? []);
    setLoading(false);
    scrollToEnd();
  }, [threadId]);

  useEffect(() => {
    load();
  }, [load]);

  // Mark all incoming messages in this thread as read when the screen focuses
  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        if (!me || !threadId) return;
        await supabase.rpc('mark_thread_read', { p_user: me, p_thread: threadId }); // decrements unread badge
      };
      run();
      // also try after initial load
      return () => {};
    }, [me, threadId])
  );

  // Realtime: receive new messages for this thread
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`messages-thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const msg = payload.new as Msg;
          setMsgs((prev) => [...prev, msg]);
          scrollToEnd();
          // If the new message is from the other user, mark as read immediately while viewing this thread
          if (msg.sender_id !== me) {
            supabase.rpc('mark_thread_read', { p_user: me, p_thread: threadId as string }).catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, me]);

  const send = async () => {
    if (!threadId || !text.trim() || !me) return;

    const optimisticMsg: Msg = {
      id: Math.random().toString(),
      thread_id: threadId,
      sender_id: me,
      content: text.trim(),
      created_at: new Date().toISOString(),
      read_at: null,
    };

    setMsgs((prev) => [...prev, optimisticMsg]);
    const contentToSend = text.trim();
    setText('');
    scrollToEnd();

    const { error } = await supabase.rpc('send_message', {
      p_thread: threadId,
      p_content: contentToSend,
    });

    if (error) {
      Alert.alert('Send error', error.message);
      setMsgs((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setText(contentToSend);
      return;
    }
    // Realtime will append the canonical row
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const mine = item.sender_id === me;
    return (
      <View style={{ paddingVertical: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <View
          style={{
            backgroundColor: mine ? '#DCF8C6' : '#EEE',
            padding: 8,
            borderRadius: 8,
            maxWidth: '80%',
          }}
        >
          <Text>{item.content}</Text>
          <Text style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
            {new Date(item.created_at).toLocaleTimeString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: '600', fontSize: 18, marginBottom: 8 }}>Chat</Text>
      <Text style={{ marginBottom: 12 }}>
        Thread: {threadId ?? '(missing)'} | With: {(label && label.length > 0 ? label : otherId) ?? '(missing)'}
      </Text>

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        ListEmptyComponent={!loading ? <Text>No messages yet</Text> : null}
        onRefresh={load}
        refreshing={loading}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          style={{ flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 }}
        />
        <Button title="Send" onPress={send} />
      </View>
    </View>
  );
}
