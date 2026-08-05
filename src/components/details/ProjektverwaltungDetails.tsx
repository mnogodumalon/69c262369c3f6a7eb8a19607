import type { Projektverwaltung, Kundenverwaltung, Rechnungsverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface ProjektverwaltungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Projektverwaltung;
  /** N:1-Ziel „Kundenverwaltung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenverwaltungList: Kundenverwaltung[];
  /** Klick auf die Kundenverwaltung-Relation → overlay.push auf dessen Detail. */
  onOpenKundenverwaltung?: (record: Kundenverwaltung) => void;
  /** 1:N „Rechnungsverwaltung": VOLLE Liste — der Block filtert auf diesen Record. */
  rechnungsverwaltungList: Rechnungsverwaltung[];
  /** Zeilen-Klick → overlay.push auf das Rechnungsverwaltung-Detail (nie der Edit-Dialog). */
  onOpenRechnungsverwaltung: (record: Rechnungsverwaltung) => void;
  /** Kontextuelles „+": öffnet den Rechnungsverwaltung-Dialog mit diesem Record vorgesetzt. */
  onAddRechnungsverwaltung: () => void;
}

export function ProjektverwaltungDetails({
  record,
  kundenverwaltungList,
  onOpenKundenverwaltung,
  rechnungsverwaltungList,
  onOpenRechnungsverwaltung,
  onAddRechnungsverwaltung,
}: ProjektverwaltungDetailsProps) {
  const kundeTarget = kundenverwaltungList.find(r => r.record_id === extractRecordId(record.fields.kunde));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Projektname" value={record.fields.projektname} format="text" />
        <RecordField label="Projektnummer" value={record.fields.projektnummer} format="text" />
        <RecordField label="Projektbeschreibung" value={record.fields.projektbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Startdatum" value={record.fields.startdatum} format="date" />
        <RecordField label="Enddatum" value={record.fields.enddatum} format="date" />
        <RecordField label="Vorname Projektleiter" value={record.fields.projektleiter_vorname} format="text" />
        <RecordField label="Nachname Projektleiter" value={record.fields.projektleiter_nachname} format="text" />
        <RecordField label="Projektstatus" value={record.fields.projektstatus} format="pill" />
        <RecordField label="Budget (€)" value={record.fields.budget} format="text" />
        <RecordField label="Notizen" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Kunde"
          name={kundeTarget?.fields.firmenname ?? '—'}
          meta={[kundeTarget?.fields.email, kundeTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={kundeTarget && onOpenKundenverwaltung ? () => onOpenKundenverwaltung!(kundeTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title="Rechnungsverwaltung"
        items={rechnungsverwaltungList.filter(r => extractRecordId(r.fields.projekt) === record.record_id)}
        map={r => ({ name: r.fields.bestellnummer ?? 'Rechnungsverwaltung', meta: r.fields.leistungszeitraum_von })}
        onOpen={onOpenRechnungsverwaltung}
        onAdd={onAddRechnungsverwaltung}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.PROJEKTVERWALTUNG} recordId={record.record_id} />
    </>
  );
}
