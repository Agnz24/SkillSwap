// hooks/use-unread-count.ts
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export function useUnreadCount(userId?: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const refresh = async () => {
      const { data, error } = await supabase.rpc('count_unread_messages', { p_user: userId });
      if (!error && typeof data === 'number') setCount(data);
    };

    refresh();

    const ch = supabase
      .channel(`unread-${userId}`)
      // New incoming message from the other user increases unread
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        const msg = p.new as any;
        if (msg.sender_id !== userId) setCount((c) => c + 1);
      })
      // When a message is marked read, decrease unread
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        const before = (p.old as any)?.read_at;
        const after = (p.new as any)?.read_at;
        const wasJustRead = !before && !!after && (p.new as any).sender_id !== userId;
        if (wasJustRead) setCount((c) => Math.max(0, c - 1));
      })
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [userId]);

  return count;
}
