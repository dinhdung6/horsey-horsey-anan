import type { SupabaseClient } from '@supabase/supabase-js';

export type Message = { id: number; text: string };

const PAGE_SIZE = 500;

export async function fetchMessages(client: SupabaseClient): Promise<Message[]> {
  const valid: Message[] = [];
  const seen = new Set<number>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('messages')
      .select('id, text')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      const id = Number(row.id);
      if (!Number.isSafeInteger(id) || id < 1 || seen.has(id) || typeof row.text !== 'string' || !row.text.trim()) {
        console.warn('Ignoring invalid or duplicate message row:', row.id);
        continue;
      }
      seen.add(id);
      valid.push({ id, text: row.text });
    }
    if (!data || data.length < PAGE_SIZE) return valid;
  }
}
