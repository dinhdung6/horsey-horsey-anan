import type { SupabaseClient } from '@supabase/supabase-js';
import type { Message } from './messages';

export type Achievement = { messageId: number; discoveredAt: string; readAt: string | null };
const PAGE_SIZE = 500;

export function hasFoundAllMessages(messages: Message[], achievements: Achievement[]) {
  if (!messages.length) return false;
  const found = new Set(achievements.map((achievement) => achievement.messageId));
  return messages.every((message) => found.has(message.id));
}

export async function fetchAchievements(client: SupabaseClient, userId: string): Promise<Achievement[]> {
  const achievements: Achievement[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('player_achievements')
      .select('message_id, discovered_at, read_at')
      .eq('user_id', userId)
      .order('discovered_at', { ascending: true })
      .order('message_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    achievements.push(...(data ?? []).flatMap((row) => {
      const messageId = Number(row.message_id);
      if (!Number.isSafeInteger(messageId) || messageId < 1 || typeof row.discovered_at !== 'string') {
        console.warn('Ignoring invalid achievement row:', row.message_id);
        return [];
      }
      return [{ messageId, discoveredAt: row.discovered_at, readAt: typeof row.read_at === 'string' ? row.read_at : null }];
    }));
    if (!data || data.length < PAGE_SIZE) return achievements;
  }
}

export async function unlockAchievement(client: SupabaseClient, userId: string, messageId: number): Promise<Achievement | null> {
  const { data, error } = await client
    .from('player_achievements')
    .insert({ user_id: userId, message_id: messageId })
    .select('message_id, discovered_at, read_at')
    .single();
  if (error?.code === '23505') return null;
  if (error) throw error;
  return {
    messageId: Number(data.message_id),
    discoveredAt: String(data.discovered_at),
    readAt: typeof data.read_at === 'string' ? data.read_at : null,
  };
}

export async function markAchievementRead(client: SupabaseClient, userId: string, messageId: number) {
  const { error } = await client
    .from('player_achievements')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('message_id', messageId)
    .is('read_at', null);
  if (error) throw error;
}

export async function resetOwnAchievements(client: SupabaseClient) {
  const { error } = await client.rpc('reset_own_achievements');
  if (error) throw error;
}
