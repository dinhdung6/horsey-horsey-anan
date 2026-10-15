import type { SupabaseClient } from '@supabase/supabase-js';

export async function getOrCreateWorldSeed(client: SupabaseClient, userId: string) {
  const seed = new Uint32Array(1);
  crypto.getRandomValues(seed);
  const { error: upsertError } = await client
    .from('player_profiles')
    .upsert(
      { user_id: userId, world_seed: seed[0] },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
  if (upsertError) throw upsertError;

  const { data, error } = await client
    .from('player_profiles')
    .select('world_seed')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  const worldSeed = Number(data.world_seed);
  if (!Number.isSafeInteger(worldSeed) || worldSeed < 0 || worldSeed > 0xffffffff) {
    throw new Error('Supabase returned an invalid player world seed.');
  }
  return worldSeed;
}
