import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Rechnungsverwaltung, Rechnungspositionen, Projektverwaltung, Leistungskatalog, Kundenverwaltung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
export function useDashboardData() {
  const [rechnungsverwaltung, setRechnungsverwaltung] = useState<Rechnungsverwaltung[]>([]);
  const [rechnungspositionen, setRechnungspositionen] = useState<Rechnungspositionen[]>([]);
  const [projektverwaltung, setProjektverwaltung] = useState<Projektverwaltung[]>([]);
  const [leistungskatalog, setLeistungskatalog] = useState<Leistungskatalog[]>([]);
  const [kundenverwaltung, setKundenverwaltung] = useState<Kundenverwaltung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [rechnungsverwaltungData, rechnungspositionenData, projektverwaltungData, leistungskatalogData, kundenverwaltungData] = await Promise.all([
        LivingAppsService.getRechnungsverwaltung(),
        LivingAppsService.getRechnungspositionen(),
        LivingAppsService.getProjektverwaltung(),
        LivingAppsService.getLeistungskatalog(),
        LivingAppsService.getKundenverwaltung(),
      ]);
      setRechnungsverwaltung(rechnungsverwaltungData);
      setRechnungspositionen(rechnungspositionenData);
      setProjektverwaltung(projektverwaltungData);
      setLeistungskatalog(leistungskatalogData);
      setKundenverwaltung(kundenverwaltungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [rechnungsverwaltungData, rechnungspositionenData, projektverwaltungData, leistungskatalogData, kundenverwaltungData] = await Promise.all([
          LivingAppsService.getRechnungsverwaltung(),
          LivingAppsService.getRechnungspositionen(),
          LivingAppsService.getProjektverwaltung(),
          LivingAppsService.getLeistungskatalog(),
          LivingAppsService.getKundenverwaltung(),
        ]);
        setRechnungsverwaltung(rechnungsverwaltungData);
        setRechnungspositionen(rechnungspositionenData);
        setProjektverwaltung(projektverwaltungData);
        setLeistungskatalog(leistungskatalogData);
        setKundenverwaltung(kundenverwaltungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const rechnungsverwaltungMap = useMemo(() => {
    const m = new Map<string, Rechnungsverwaltung>();
    rechnungsverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [rechnungsverwaltung]);

  const projektverwaltungMap = useMemo(() => {
    const m = new Map<string, Projektverwaltung>();
    projektverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [projektverwaltung]);

  const leistungskatalogMap = useMemo(() => {
    const m = new Map<string, Leistungskatalog>();
    leistungskatalog.forEach(r => m.set(r.record_id, r));
    return m;
  }, [leistungskatalog]);

  const kundenverwaltungMap = useMemo(() => {
    const m = new Map<string, Kundenverwaltung>();
    kundenverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [kundenverwaltung]);

  return { rechnungsverwaltung, setRechnungsverwaltung, rechnungspositionen, setRechnungspositionen, projektverwaltung, setProjektverwaltung, leistungskatalog, setLeistungskatalog, kundenverwaltung, setKundenverwaltung, loading, error, fetchAll, rechnungsverwaltungMap, projektverwaltungMap, leistungskatalogMap, kundenverwaltungMap };
}