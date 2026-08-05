import type { Rechnungspositionen, Rechnungsverwaltung, Leistungskatalog } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface RechnungspositionenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Rechnungspositionen;
  /** N:1-Ziel „Rechnungsverwaltung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  rechnungsverwaltungList: Rechnungsverwaltung[];
  /** Klick auf die Rechnungsverwaltung-Relation → overlay.push auf dessen Detail. */
  onOpenRechnungsverwaltung?: (record: Rechnungsverwaltung) => void;
  /** N:1-Ziel „Leistungskatalog": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  leistungskatalogList: Leistungskatalog[];
  /** Klick auf die Leistungskatalog-Relation → overlay.push auf dessen Detail. */
  onOpenLeistungskatalog?: (record: Leistungskatalog) => void;
}

export function RechnungspositionenDetails({
  record,
  rechnungsverwaltungList,
  onOpenRechnungsverwaltung,
  leistungskatalogList,
  onOpenLeistungskatalog,
}: RechnungspositionenDetailsProps) {
  const rechnungTarget = rechnungsverwaltungList.find(r => r.record_id === extractRecordId(record.fields.rechnung));
  const leistungTarget = leistungskatalogList.find(r => r.record_id === extractRecordId(record.fields.leistung));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Positionsnummer" value={record.fields.positionsnummer} format="text" />
        <RecordField label="Positionsbeschreibung" value={record.fields.positionsbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Menge" value={record.fields.menge} format="text" />
        <RecordField label="Einheit" value={record.fields.einheit} format="pill" />
        <RecordField label="Einzelpreis (€)" value={record.fields.einzelpreis} format="text" />
        <RecordField label="Rabatt (%)" value={record.fields.rabatt_prozent} format="text" />
        <RecordField label="Gesamtpreis (€)" value={record.fields.gesamtpreis} format="text" />
        <RecordField label="Anmerkungen zur Position" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={2}>
        <RecordRelation
          label="Rechnung"
          name={rechnungTarget?.fields.rechnungsnummer ?? '—'}
          meta={[rechnungTarget?.fields.bestellnummer].filter(Boolean).join(' · ') || undefined}
          onClick={rechnungTarget && onOpenRechnungsverwaltung ? () => onOpenRechnungsverwaltung!(rechnungTarget!) : undefined}
        />
        <RecordRelation
          label="Leistung aus Katalog"
          name={leistungTarget?.fields.leistungsbezeichnung ?? '—'}
          meta={undefined}
          onClick={leistungTarget && onOpenLeistungskatalog ? () => onOpenLeistungskatalog!(leistungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.RECHNUNGSPOSITIONEN} recordId={record.record_id} />
    </>
  );
}
