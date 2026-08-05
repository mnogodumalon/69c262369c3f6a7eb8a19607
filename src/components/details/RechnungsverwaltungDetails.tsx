import type { Rechnungsverwaltung, Projektverwaltung, Kundenverwaltung, Rechnungspositionen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface RechnungsverwaltungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Rechnungsverwaltung;
  /** N:1-Ziel „Projektverwaltung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  projektverwaltungList: Projektverwaltung[];
  /** Klick auf die Projektverwaltung-Relation → overlay.push auf dessen Detail. */
  onOpenProjektverwaltung?: (record: Projektverwaltung) => void;
  /** N:1-Ziel „Kundenverwaltung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenverwaltungList: Kundenverwaltung[];
  /** Klick auf die Kundenverwaltung-Relation → overlay.push auf dessen Detail. */
  onOpenKundenverwaltung?: (record: Kundenverwaltung) => void;
  /** 1:N „Rechnungspositionen": VOLLE Liste — der Block filtert auf diesen Record. */
  rechnungspositionenList: Rechnungspositionen[];
  /** Zeilen-Klick → overlay.push auf das Rechnungspositionen-Detail (nie der Edit-Dialog). */
  onOpenRechnungspositionen: (record: Rechnungspositionen) => void;
  /** Kontextuelles „+": öffnet den Rechnungspositionen-Dialog mit diesem Record vorgesetzt. */
  onAddRechnungspositionen: () => void;
}

export function RechnungsverwaltungDetails({
  record,
  projektverwaltungList,
  onOpenProjektverwaltung,
  kundenverwaltungList,
  onOpenKundenverwaltung,
  rechnungspositionenList,
  onOpenRechnungspositionen,
  onAddRechnungspositionen,
}: RechnungsverwaltungDetailsProps) {
  const projektTarget = projektverwaltungList.find(r => r.record_id === extractRecordId(record.fields.projekt));
  const kundeTarget = kundenverwaltungList.find(r => r.record_id === extractRecordId(record.fields.kunde));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Zahlungsbedingungen" value={record.fields.zahlungsbedingungen} format="pill" />
        <RecordField label="Steuersatz" value={record.fields.steuersatz} format="pill" />
        <RecordField label="Nettobetrag (€)" value={record.fields.nettobetrag} format="text" />
        <RecordField label="Steuerbetrag (€)" value={record.fields.steuerbetrag} format="text" />
        <RecordField label="Bruttobetrag (€)" value={record.fields.bruttobetrag} format="text" />
        <RecordField label="Währung" value={record.fields.waehrung} format="pill" />
        <RecordField label="Leistungszeitraum von" value={record.fields.leistungszeitraum_von} format="date" />
        <RecordField label="Leistungszeitraum bis" value={record.fields.leistungszeitraum_bis} format="date" />
        <RecordField label="Bestellnummer / Referenz" value={record.fields.bestellnummer} format="text" />
        <RecordField label="Bemerkungen / Notizen" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
        <RecordField label="Anhang (z.B. Stundennachweis)" className="md:col-span-2">
          {record.fields.anhang ? (
            <MediaThumbnail src={record.fields.anhang as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label="Rechnungsdatum" value={record.fields.rechnungsdatum} format="date" />
        <RecordField label="Fälligkeitsdatum" value={record.fields.faelligkeitsdatum} format="date" />
        <RecordField label="Rechnungsstatus" value={record.fields.rechnungsstatus} format="pill" />
        <RecordField label="Rechnungsnummer" value={record.fields.rechnungsnummer} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={2}>
        <RecordRelation
          label="Projekt"
          name={projektTarget?.fields.projektname ?? '—'}
          meta={[projektTarget?.fields.projektnummer, projektTarget?.fields.projektleiter_vorname].filter(Boolean).join(' · ') || undefined}
          onClick={projektTarget && onOpenProjektverwaltung ? () => onOpenProjektverwaltung!(projektTarget!) : undefined}
        />
        <RecordRelation
          label="Kunde"
          name={kundeTarget?.fields.firmenname ?? '—'}
          meta={[kundeTarget?.fields.email, kundeTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={kundeTarget && onOpenKundenverwaltung ? () => onOpenKundenverwaltung!(kundeTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title="Rechnungspositionen"
        items={rechnungspositionenList.filter(r => extractRecordId(r.fields.rechnung) === record.record_id)}
        map={_r => ({ name: 'Rechnungspositionen', meta: undefined })}
        onOpen={onOpenRechnungspositionen}
        onAdd={onAddRechnungspositionen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.RECHNUNGSVERWALTUNG} recordId={record.record_id} />
    </>
  );
}
