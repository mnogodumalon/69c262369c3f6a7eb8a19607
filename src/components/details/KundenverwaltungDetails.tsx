import type { Kundenverwaltung, Rechnungsverwaltung, Projektverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface KundenverwaltungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Kundenverwaltung;
  /** 1:N „Rechnungsverwaltung": VOLLE Liste — der Block filtert auf diesen Record. */
  rechnungsverwaltungList: Rechnungsverwaltung[];
  /** Zeilen-Klick → overlay.push auf das Rechnungsverwaltung-Detail (nie der Edit-Dialog). */
  onOpenRechnungsverwaltung: (record: Rechnungsverwaltung) => void;
  /** Kontextuelles „+": öffnet den Rechnungsverwaltung-Dialog mit diesem Record vorgesetzt. */
  onAddRechnungsverwaltung: () => void;
  /** 1:N „Projektverwaltung": VOLLE Liste — der Block filtert auf diesen Record. */
  projektverwaltungList: Projektverwaltung[];
  /** Zeilen-Klick → overlay.push auf das Projektverwaltung-Detail (nie der Edit-Dialog). */
  onOpenProjektverwaltung: (record: Projektverwaltung) => void;
  /** Kontextuelles „+": öffnet den Projektverwaltung-Dialog mit diesem Record vorgesetzt. */
  onAddProjektverwaltung: () => void;
}

export function KundenverwaltungDetails({
  record,
  rechnungsverwaltungList,
  onOpenRechnungsverwaltung,
  onAddRechnungsverwaltung,
  projektverwaltungList,
  onOpenProjektverwaltung,
  onAddProjektverwaltung,
}: KundenverwaltungDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Firmenname" value={record.fields.firmenname} format="text" />
        <RecordField label="Vorname Ansprechpartner" value={record.fields.ansprechpartner_vorname} format="text" />
        <RecordField label="Nachname Ansprechpartner" value={record.fields.ansprechpartner_nachname} format="text" />
        <RecordField label="E-Mail-Adresse" value={record.fields.email} format="email" />
        <RecordField label="Telefonnummer" value={record.fields.telefon} format="text" />
        <RecordField label="Straße" value={record.fields.strasse} format="text" />
        <RecordField label="Hausnummer" value={record.fields.hausnummer} format="text" />
        <RecordField label="Postleitzahl" value={record.fields.plz} format="text" />
        <RecordField label="Ort" value={record.fields.ort} format="text" />
        <RecordField label="Land" value={record.fields.land} format="text" />
        <RecordField label="Steuernummer / USt-IdNr." value={record.fields.steuernummer} format="text" />
        <RecordField label="Zahlungsbedingungen" value={record.fields.zahlungsbedingungen} format="pill" />
        <RecordField label="IBAN" value={record.fields.iban} format="text" />
        <RecordField label="Interne Notizen" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Rechnungsverwaltung"
        items={rechnungsverwaltungList.filter(r => extractRecordId(r.fields.kunde) === record.record_id)}
        map={r => ({ name: r.fields.bestellnummer ?? 'Rechnungsverwaltung', meta: r.fields.leistungszeitraum_von })}
        onOpen={onOpenRechnungsverwaltung}
        onAdd={onAddRechnungsverwaltung}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title="Projektverwaltung"
        items={projektverwaltungList.filter(r => extractRecordId(r.fields.kunde) === record.record_id)}
        map={r => ({ name: r.fields.projektname ?? 'Projektverwaltung', meta: r.fields.startdatum })}
        onOpen={onOpenProjektverwaltung}
        onAdd={onAddProjektverwaltung}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.KUNDENVERWALTUNG} recordId={record.record_id} />
    </>
  );
}
