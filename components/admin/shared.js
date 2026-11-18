'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ACCOUNT_STATE, daysUntil, fmtDateShort } from '@/lib/format';

export const STATE_PILL = { trial: 'confirmed', active: 'completed', grace: 'no_show', expired: 'cancelled', suspended: 'cancelled' };

export function StatePill({ state }) {
  return <span className={`pill ${STATE_PILL[state]}`}>{ACCOUNT_STATE[state]}</span>;
}

/** Texto corto de vigencia: "Prueba · 9 días", "Pagado hasta 15 dic". */
export function coverage(b) {
  if (b.state === 'trial') return `Prueba · ${Math.max(0, daysUntil(b.trial_ends_at))} días`;
  if (b.state === 'active') return `Hasta ${fmtDateShort(b.paid_until)}`;
  const end = [b.paid_until, b.trial_ends_at].filter(Boolean).sort().pop();
  return end ? `Venció ${fmtDateShort(end)}` : '—';
}

export function useAdminBusinesses() {
  const supabase = supabaseBrowser();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('admin_businesses');
    if (e) { setError(e.message); setList([]); return; }
    setList(data || []);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);
  return { list, error, reload: load, supabase };
}
