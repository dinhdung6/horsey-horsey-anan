import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAchievements, hasFoundAllMessages, markAchievementRead, resetOwnAchievements, unlockAchievement } from './achievements';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fakeClient(response: unknown, calls: unknown[][]) {
  return {
    rpc(name: string, args?: Record<string, unknown>) {
      calls.push(['rpc', name, args]);
      return Promise.resolve(response);
    },
    from(table: string) {
      calls.push(['from', table]);
      const query: any = {
        select: (...args: unknown[]) => { calls.push(['select', ...args]); return query; },
        eq: (...args: unknown[]) => { calls.push(['eq', ...args]); return query; },
        is: (...args: unknown[]) => { calls.push(['is', ...args]); return query; },
        order: (...args: unknown[]) => { calls.push(['order', ...args]); return query; },
        range: (...args: unknown[]) => { calls.push(['range', ...args]); return query; },
        insert: (...args: unknown[]) => { calls.push(['insert', ...args]); return query; },
        update: (...args: unknown[]) => { calls.push(['update', ...args]); return query; },
        single: () => Promise.resolve(response),
        then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(response).then(resolve, reject),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

const rows = [
  { message_id: 4, discovered_at: '2026-01-01T00:00:00Z', read_at: '2026-01-01T01:00:00Z' },
  { message_id: 8, discovered_at: '2026-01-02T00:00:00Z', read_at: null },
];
const activeMessages = [{ id: 4, text: 'four' }, { id: 8, text: 'eight' }];
assert(hasFoundAllMessages(activeMessages, [
  { messageId: 4, discoveredAt: '', readAt: null },
  { messageId: 8, discoveredAt: '', readAt: null },
  { messageId: 99, discoveredAt: '', readAt: null },
]), 'completion should require every active message and ignore old inactive achievements');
assert(!hasFoundAllMessages(activeMessages, [{ messageId: 4, discoveredAt: '', readAt: null }]), 'completion must stay false while an active message is missing');
assert(!hasFoundAllMessages([], []), 'empty message lists should not enable reset');
for (const userId of ['player-a', 'player-b']) {
  const calls: unknown[][] = [];
  const found = await fetchAchievements(fakeClient({ data: rows, error: null }, calls), userId);
  assert(found.length === 2 && found[0].messageId === 4, 'database discovery order should be preserved');
  assert(calls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === userId), 'achievement reads must be scoped to the signed-in user');
}

const insertedCalls: unknown[][] = [];
const inserted = await unlockAchievement(fakeClient({
  data: { message_id: 9, discovered_at: '2026-01-03T00:00:00Z', read_at: null }, error: null,
}, insertedCalls), 'player-a', 9);
assert(inserted?.messageId === 9 && inserted.discoveredAt === '2026-01-03T00:00:00Z', 'insert should use the database discovery timestamp');
const insertPayload = insertedCalls.find((call) => call[0] === 'insert')?.[1] as Record<string, unknown>;
assert(Object.keys(insertPayload).sort().join(',') === 'message_id,user_id', 'discovery inserts must not send a client timestamp');

const duplicate = await unlockAchievement(fakeClient({ data: null, error: { code: '23505' } }, []), 'player-a', 9);
assert(duplicate === null, 'duplicate discovery should be treated as already unlocked');

let failed = false;
try {
  await unlockAchievement(fakeClient({ data: null, error: { code: 'NETWORK_ERROR' } }, []), 'player-a', 9);
} catch {
  failed = true;
}
assert(failed, 'database failures must be returned to the caller for retry handling');

const readCalls: unknown[][] = [];
await markAchievementRead(fakeClient({ data: null, error: null }, readCalls), 'player-a', 9);
assert(readCalls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'player-a'), 'read updates must be scoped to the signed-in user');
assert(readCalls.some((call) => call[0] === 'eq' && call[1] === 'message_id' && call[2] === 9), 'read updates must be scoped to the message');
assert(readCalls.some((call) => call[0] === 'is' && call[1] === 'read_at' && call[2] === null), 'read updates must only set an unread row');

const resetCalls: unknown[][] = [];
await resetOwnAchievements(fakeClient({ data: null, error: null }, resetCalls));
assert(resetCalls.some((call) => call[0] === 'rpc' && call[1] === 'reset_own_achievements'), 'reset must use the user-scoped database RPC');
failed = false;
try {
  await resetOwnAchievements(fakeClient({ data: null, error: { code: 'RPC_ERROR' } }, []));
} catch {
  failed = true;
}
assert(failed, 'reset failures must be returned to the UI');
console.info('Achievement data checks passed.');
