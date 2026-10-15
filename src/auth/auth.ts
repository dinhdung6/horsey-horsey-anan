import type { SupabaseClient, User } from '@supabase/supabase-js';

export type AuthMode = 'sign-in' | 'sign-up';

export async function submitAuth(
  client: SupabaseClient,
  mode: AuthMode,
  email: string,
  password: string
) {
  if (mode === 'sign-up') {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    return data.session ? 'Account created. Loading your world…' : 'Account created. Check your email to confirm it, then sign in.';
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return 'Signed in. Loading your world…';
}

export async function restoreSession(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export function watchAuth(
  client: SupabaseClient,
  onUser: (user: User | null) => void
) {
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => onUser(session?.user ?? null), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut(client: SupabaseClient) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
