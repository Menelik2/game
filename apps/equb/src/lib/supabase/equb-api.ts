/**
 * Supabase-backed Equb (when NEXT_PUBLIC_SUPABASE_* is set).
 */
import { getSupabase, isSupabaseConfigured } from './client';

export { isSupabaseConfigured };

export type DbRound = {
  id: string;
  template_id: string;
  group_size: number;
  prize_pool: number;
  contribution: number;
  status: string;
  seats_taken: number;
  winning_number: number | null;
  winner_user_id: string | null;
  entropy_hex: string | null;
  commitment_hash: string | null;
  draw_at: string;
  drawn_at: string | null;
};

export type DbSeat = {
  id: string;
  round_id: string;
  user_id: string;
  display_name: string;
  pick_number: number;
  fee_paid: number;
  joined_at: string;
};

export type DbWallet = {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
};

export async function listTemplates() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('equb_templates')
    .select('*')
    .eq('is_active', true)
    .order('group_size')
    .order('prize_pool');
  if (error) throw error;
  return data;
}

export async function ensureOpenRound(templateId: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.rpc('equb_ensure_open_round', {
    p_template_id: templateId,
  });
  if (error) throw error;
  return data as DbRound;
}

export async function joinRound(
  templateId: string,
  pick: number,
  displayName?: string,
) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.rpc('equb_join_round', {
    p_template_id: templateId,
    p_pick: pick,
    p_display_name: displayName ?? null,
  });
  if (error) throw error;
  return data as DbRound;
}

export async function drawRound(roundId: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.rpc('equb_draw_round', {
    p_round_id: roundId,
  });
  if (error) throw error;
  return data as DbRound;
}

export async function getRound(roundId: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('equb_rounds')
    .select('*')
    .eq('id', roundId)
    .single();
  if (error) throw error;
  return data as DbRound;
}

export async function listSeats(roundId: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('equb_seats')
    .select('*')
    .eq('round_id', roundId)
    .order('pick_number');
  if (error) throw error;
  return data as DbSeat[];
}

export async function getMyWallet() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (error) throw error;
  return data as DbWallet;
}

export async function getMyLedger(limit = 30) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('ledger_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export function subscribeRound(roundId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`round:${roundId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'equb_rounds', filter: `id=eq.${roundId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'equb_seats',
        filter: `round_id=eq.${roundId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
