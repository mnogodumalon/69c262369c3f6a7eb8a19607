import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Rechnungsverwaltung, Projektverwaltung, Kundenverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { RechnungsverwaltungDialog } from '@/components/dialogs/RechnungsverwaltungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Rechnungsverwaltung';
import { evalComputed } from '@/config/form-enhancements/types';

export default function RechnungsverwaltungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Rechnungsverwaltung | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [projektverwaltungList, setProjektverwaltungList] = useState<Projektverwaltung[]>([]);
  const [kundenverwaltungList, setKundenverwaltungList] = useState<Kundenverwaltung[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, projektverwaltungData, kundenverwaltungData] = await Promise.all([
        LivingAppsService.getRechnungsverwaltung(),
        LivingAppsService.getProjektverwaltung(),
        LivingAppsService.getKundenverwaltung(),
      ]);
      setProjektverwaltungList(projektverwaltungData);
      setKundenverwaltungList(kundenverwaltungData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Rechnungsverwaltung['fields']) {
    if (!record) return;
    await LivingAppsService.updateRechnungsverwaltungEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteRechnungsverwaltungEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/rechnungsverwaltung');
  }

  function getProjektverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return projektverwaltungList.find(r => r.record_id === refId)?.fields.projektname ?? '—';
  }

  function getKundenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return kundenverwaltungList.find(r => r.record_id === refId)?.fields.firmenname ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/rechnungsverwaltung')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/rechnungsverwaltung')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.bestellnummer ?? 'Rechnungsverwaltung'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          projekt: projektverwaltungList,
          kunde: kundenverwaltungList,
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
        <RecordField label="Projekt" value={getProjektverwaltungDisplayName(record.fields.projekt)} format="text" />
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
        <RecordField label="Rechnungsdatum" value={record.fields.rechnungsdatum} format="date" />
        <RecordField label="Fälligkeitsdatum" value={record.fields.faelligkeitsdatum} format="date" />
        <RecordField label="Rechnungsstatus" value={record.fields.rechnungsstatus} format="pill" />
        <RecordField label="Kunde" value={getKundenverwaltungDisplayName(record.fields.kunde)} format="text" />
        <RecordField label="Rechnungsnummer" value={record.fields.rechnungsnummer} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.RECHNUNGSVERWALTUNG} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <RechnungsverwaltungDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        projektverwaltungList={projektverwaltungList}
        kundenverwaltungList={kundenverwaltungList}
        enablePhotoScan={AI_PHOTO_SCAN['Rechnungsverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Rechnungsverwaltung']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Rechnungsverwaltung löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
