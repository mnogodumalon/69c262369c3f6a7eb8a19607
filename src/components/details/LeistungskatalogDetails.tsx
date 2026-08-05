import type { Leistungskatalog, Rechnungspositionen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface LeistungskatalogDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Leistungskatalog;
  /** 1:N „Rechnungspositionen": VOLLE Liste — der Block filtert auf diesen Record. */
  rechnungspositionenList: Rechnungspositionen[];
  /** Zeilen-Klick → overlay.push auf das Rechnungspositionen-Detail (nie der Edit-Dialog). */
  onOpenRechnungspositionen: (record: Rechnungspositionen) => void;
  /** Kontextuelles „+": öffnet den Rechnungspositionen-Dialog mit diesem Record vorgesetzt. */
  onAddRechnungspositionen: () => void;
}

export function LeistungskatalogDetails({
  record,
  rechnungspositionenList,
  onOpenRechnungspositionen,
  onAddRechnungspositionen,
}: LeistungskatalogDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Leistungsbezeichnung" value={record.fields.leistungsbezeichnung} format="text" />
        <RecordField label="Beschreibung" value={record.fields.leistungsbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Einheit" value={record.fields.einheit} format="pill" />
        <RecordField label="Standardpreis (€)" value={record.fields.standardpreis} format="text" />
        <RecordField label="Währung" value={record.fields.waehrung} format="pill" />
        <RecordField label="Leistung aktiv" value={record.fields.aktiv} format="bool" />
      </RecordSection>

      <SatelliteSection
        title="Rechnungspositionen"
        items={rechnungspositionenList.filter(r => extractRecordId(r.fields.leistung) === record.record_id)}
        map={_r => ({ name: 'Rechnungspositionen', meta: undefined })}
        onOpen={onOpenRechnungspositionen}
        onAdd={onAddRechnungspositionen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.LEISTUNGSKATALOG} recordId={record.record_id} />
    </>
  );
}
