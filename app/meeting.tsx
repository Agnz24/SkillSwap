// app/meeting.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Linking, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

type Slot = {
  id: string;
  user_id: string;
  start_at: string;
  end_at: string;
  timezone: string;
  notes: string | null;
};

export default function MeetingScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookerId, setBookerId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerLabel, setPartnerLabel] = useState<string>('');
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [busy, setBusy] = useState<boolean>(false);

  // Feedback state
  const [myFeedbackId, setMyFeedbackId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? '';
      setUserId(uid);
    });
  }, []);

  useEffect(() => {
    if (!slotId) return;
    const load = async () => {
      const { data: s, error: sErr } = await supabase
        .from('availability_slots')
        .select('id,user_id,start_at,end_at,timezone,notes')
        .eq('id', slotId)
        .maybeSingle();
      if (sErr) {
        Alert.alert('Error', sErr.message);
        return;
      }
      setSlot(s as Slot | null);

      const { data: b, error: bErr } = await supabase
        .from('bookings')
        .select('id,slot_id,booker_id,meeting_url')
        .eq('slot_id', slotId)
        .maybeSingle();
      if (bErr) {
        console.log('booking lookup error', bErr);
      }
      setBookingId(b?.id ?? null);
      setBookerId(b?.booker_id ?? null);
      setMeetingUrl(b?.meeting_url ?? null);

      let pid: string | null = null;
      if (s?.user_id && b?.booker_id) {
        pid = (userId && userId === s.user_id) ? b.booker_id : s.user_id;
      }
      setPartnerId(pid);

      if (pid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email,display_name')
          .eq('id', pid)
          .maybeSingle();
        setPartnerLabel(prof?.display_name || prof?.email || '');
      } else {
        setPartnerLabel('');
      }

      // Load my existing feedback (if any)
      if (userId) {
        const { data: fb } = await supabase
          .from('session_feedback')
          .select('id,rating,note')
          .eq('slot_id', slotId)
          .eq('rater_id', userId)
          .maybeSingle();
        setMyFeedbackId(fb?.id ?? null);
        setRating(fb?.rating ?? 0);
        setNote(fb?.note ?? '');
      }
    };
    load();
  }, [slotId, userId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = slot ? new Date(slot.start_at) : null;
  const end = slot ? new Date(slot.end_at) : null;

  const state = useMemo<'before' | 'live' | 'after'>(() => {
    if (!start || !end) return 'after';
    if (now < start) return 'before';
    if (now >= start && now <= end) return 'live';
    return 'after';
  }, [now, start, end]);

  const countdown = useMemo(() => {
    const target = state === 'before' ? start : state === 'live' ? end : null;
    if (!target) return '';
    const diff = Math.max(0, target.getTime() - now.getTime());
    const sec = Math.floor(diff / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [now, start, end, state]);

  useEffect(() => {
    if (!start) return;
    const tick = setInterval(() => {
      const diffMin = Math.floor((start.getTime() - Date.now()) / 60000);
      if (diffMin === 15) {
        Alert.alert('Reminder', 'Your session starts in 15 minutes.');
      }
    }, 60000);
    return () => clearInterval(tick);
  }, [start]);

  const openChat = async () => {
    try {
      if (!partnerId) {
        Alert.alert('No partner', 'This session is not booked yet.');
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed?.session?.user?.id) {
          Alert.alert('Not authenticated', 'Please sign in again');
          return;
        }
      }

      const { data, error } = await supabase.rpc('get_or_create_thread', { p_other: partnerId });
      if (error) {
        Alert.alert('Chat error', error.message);
        return;
      }
      const threadId = data as string;

      router.push({ pathname: '/chat', params: { threadId, otherId: partnerId, label: partnerLabel } });
    } catch (e: any) {
      Alert.alert('Chat error', e.message ?? String(e));
    }
  };

  const joinCall = () => {
    if (!meetingUrl) {
      Alert.alert('No link yet', 'Meeting link is not available.');
      return;
    }
    Linking.openURL(meetingUrl);
  };

  const canCancel =
    !!bookingId &&
    !!slot &&
    (userId === slot.user_id || userId === bookerId);

  const cancelBooking = () => {
    if (!bookingId) return;
    Alert.alert(
      'Cancel booking?',
      'This will free the slot for others.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', bookingId);
              setBusy(false);
              if (error) {
                Alert.alert('Cancel error', error.message);
                return;
              }
              setBookingId(null);
              setBookerId(null);
              setPartnerId(null);
              setPartnerLabel('');
              setMeetingUrl(null);
              Alert.alert('Canceled', 'Booking has been canceled.');
            } catch (e: any) {
              setBusy(false);
              Alert.alert('Cancel error', e.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  // Feedback helpers
  const StarRow = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <View style={{ flexDirection: 'row', marginVertical: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text
          key={n}
          onPress={() => onChange(n)}
          style={{ fontSize: 28, marginRight: 6, color: n <= value ? '#f5b50a' : '#aaa' }}
        >
          ★
        </Text>
      ))}
    </View>
  );

  const submitFeedback = async () => {
    try {
      if (!slot || !partnerId) {
        Alert.alert('Not ready', 'Missing session or partner.');
        return;
      }
      if (rating < 1 || rating > 5) {
        Alert.alert('Pick rating', 'Choose between 1 and 5 stars.');
        return;
      }
      if (myFeedbackId) {
        const { error } = await supabase
          .from('session_feedback')
          .update({ rating, note })
          .eq('id', myFeedbackId);
        if (error) return Alert.alert('Save error', error.message);
        Alert.alert('Saved', 'Feedback updated.');
      } else {
        const { data, error } = await supabase
          .from('session_feedback')
          .insert({
            slot_id: slot.id,
            rater_id: userId,
            ratee_id: partnerId,
            rating,
            note,
          })
          .select('id')
          .maybeSingle();
        if (error) return Alert.alert('Submit error', error.message);
        setMyFeedbackId(data?.id ?? null);
        Alert.alert('Thanks', 'Feedback submitted.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#FFF' }}>
      {!slot ? (
        <Text>Loading meeting…</Text>
      ) : (
        <>
          <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>Session</Text>
          <Text>
            {new Date(slot.start_at).toLocaleString()} – {new Date(slot.end_at).toLocaleString()}
          </Text>
          <Text style={{ color: '#666', marginTop: 4 }}>TZ: {slot.timezone}</Text>
          {slot.notes ? <Text style={{ color: '#666', marginTop: 4 }}>{slot.notes}</Text> : null}

          <View style={{ marginTop: 16 }}>
            <Text>Status: {state === 'before' ? 'Starts in' : state === 'live' ? 'Ends in' : 'Finished'}</Text>
            <Text style={{ fontSize: 24, fontWeight: '600', marginTop: 4 }}>{countdown}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Button title="Open chat" onPress={openChat} />
            {state !== 'after' ? (
              <Button
                title={state === 'before' ? 'Join when live' : 'Join call'}
                onPress={joinCall}
              />
            ) : null}
          </View>

          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
            {canCancel ? (
              <Button title={busy ? 'Cancelling…' : 'Cancel booking'} onPress={cancelBooking} disabled={busy} />
            ) : null}
          </View>

          <View style={{ marginTop: 16 }}>
            <Text>Partner: {partnerLabel || 'Not booked yet'}</Text>
            {meetingUrl ? <Text style={{ color: '#666', marginTop: 4 }}>Link: {meetingUrl}</Text> : null}
          </View>

          {state === 'after' ? (
            <View style={{ marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' }}>
              <Text style={{ fontWeight: '600' }}>{myFeedbackId ? 'Your feedback' : 'Rate this session'}</Text>
              <StarRow value={rating} onChange={setRating} />
              <Text style={{ fontWeight: '600', marginTop: 8 }}>Note (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="How did it go?"
                multiline
                numberOfLines={3}
                style={{ borderWidth: 1, borderRadius: 8, padding: 8, textAlignVertical: 'top', marginTop: 6 }}
              />
              <View style={{ marginTop: 12 }}>
                <Button title={myFeedbackId ? 'Update feedback' : 'Submit feedback'} onPress={submitFeedback} />
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
