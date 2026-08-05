import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Rechnungspositionen, Rechnungsverwaltung, Leistungskatalog } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { RechnungspositionenDialog } from '@/components/dialogs/RechnungspositionenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Rechnungspositionen';
import { evalComputed } from '@/config/form-enhancements/types';

export default function RechnungspositionenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Rechnungspositionen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rechnungsverwaltungList, setRechnungsverwaltungList] = useState<Rechnungsverwaltung[]>([]);
  const [leistungskatalogList, setLeistungskatalogList] = useState<Leistungskatalog[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, rechnungsverwaltungData, leistungskatalogData] = await Promise.all([
        LivingAppsService.getRechnungspositionen(),
        LivingAppsService.getRechnungsverwaltung(),
        LivingAppsService.getLeistungskatalog(),
      ]);
      setRechnungsverwaltungList(rechnungsverwaltungData);
      setLeistungskatalogList(leistungskatalogData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Rechnungspositionen['fields']) {
    if (!record) return;
    await LivingAppsService.updateRechnungspositionenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteRechnungspositionenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/rechnungspositionen');
  }

  function getRechnungsverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return rechnungsverwaltungList.find(r => r.record_id === refId)?.fields.rechnungsnummer ?? '—';
  }

  function getLeistungskatalogDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return leistungskatalogList.find(r => r.record_id === refId)?.fields.leistungsbezeichnung ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/rechnungspositionen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/rechnungspositionen')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={'Rechnungspositionen'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          rechnung: rechnungsverwaltungList,
          leistung: leistungskatalogList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Rechnung" value={getRechnungsverwaltungDisplayName(record.fields.rechnung)} format="text" />
        <RecordField label="Positionsnummer" value={record.fields.positionsnummer} format="text" />
        <RecordField label="Leistung aus Katalog" value={getLeistungskatalogDisplayName(record.fields.leistung)} format="text" />
        <RecordField label="Positionsbeschreibung" value={record.fields.positionsbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Menge" value={record.fields.menge} format="text" />
        <RecordField label="Einheit" value={record.fields.einheit} format="pill" />
        <RecordField label="Einzelpreis (€)" value={record.fields.einzelpreis} format="text" />
        <RecordField label="Rabatt (%)" value={record.fields.rabatt_prozent} format="text" />
        <RecordField label="Gesamtpreis (€)" value={record.fields.gesamtpreis} format="text" />
        <RecordField label="Anmerkungen zur Position" value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.RECHNUNGSPOSITIONEN} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <RechnungspositionenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        rechnungsverwaltungList={rechnungsverwaltungList}
        leistungskatalogList={leistungskatalogList}
        enablePhotoScan={AI_PHOTO_SCAN['Rechnungspositionen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Rechnungspositionen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Rechnungspositionen löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
