'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);
export const usePanel = () => useContext(Ctx);
export const PanelProvider = Ctx.Provider;

/** Mensaje flotante breve. */
export function useToast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return [node, setMsg];
}

/** Carga servicios y equipo del negocio. */
export function useCatalog(supabase, bizId) {
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffServices, setStaffServices] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!bizId) return;
    const [{ data: sv }, { data: st }] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', bizId).order('sort').order('created_at'),
      supabase.from('staff').select('*').eq('business_id', bizId).order('sort').order('created_at'),
    ]);
    const ids = (st || []).map((s) => s.id);
    const { data: ss } = ids.length
      ? await supabase.from('staff_services').select('*').in('staff_id', ids)
      : { data: [] };
    setServices(sv || []);
    setStaff(st || []);
    setStaffServices(ss || []);
    setLoaded(true);
  }, [supabase, bizId]);
  useEffect(() => { load(); }, [load]);
  return { services, staff, staffServices, loaded, reload: load };
}

export const doesService = (staffServices, staffId, serviceId) => {
  const rows = staffServices.filter((x) => x.staff_id === staffId);
  return rows.length === 0 || rows.some((x) => x.service_id === serviceId);
};
