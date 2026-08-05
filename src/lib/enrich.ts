import type { EnrichedProjektverwaltung, EnrichedRechnungspositionen, EnrichedRechnungsverwaltung } from '@/types/enriched';
import type { Kundenverwaltung, Leistungskatalog, Projektverwaltung, Rechnungspositionen, Rechnungsverwaltung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface RechnungsverwaltungMaps {
  projektverwaltungMap: Map<string, Projektverwaltung>;
  kundenverwaltungMap: Map<string, Kundenverwaltung>;
}

export function enrichRechnungsverwaltung(
  rechnungsverwaltung: Rechnungsverwaltung[],
  maps: RechnungsverwaltungMaps
): EnrichedRechnungsverwaltung[] {
  return rechnungsverwaltung.map(r => ({
    ...r,
    projektName: resolveDisplay(r.fields.projekt, maps.projektverwaltungMap, 'projektname'),
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenverwaltungMap, 'firmenname'),
  }));
}

interface RechnungspositionenMaps {
  rechnungsverwaltungMap: Map<string, Rechnungsverwaltung>;
  leistungskatalogMap: Map<string, Leistungskatalog>;
}

export function enrichRechnungspositionen(
  rechnungspositionen: Rechnungspositionen[],
  maps: RechnungspositionenMaps
): EnrichedRechnungspositionen[] {
  return rechnungspositionen.map(r => ({
    ...r,
    rechnungName: resolveDisplay(r.fields.rechnung, maps.rechnungsverwaltungMap, 'rechnungsnummer'),
    leistungName: resolveDisplay(r.fields.leistung, maps.leistungskatalogMap, 'leistungsbezeichnung'),
  }));
}

interface ProjektverwaltungMaps {
  kundenverwaltungMap: Map<string, Kundenverwaltung>;
}

export function enrichProjektverwaltung(
  projektverwaltung: Projektverwaltung[],
  maps: ProjektverwaltungMaps
): EnrichedProjektverwaltung[] {
  return projektverwaltung.map(r => ({
    ...r,
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenverwaltungMap, 'firmenname'),
  }));
}
