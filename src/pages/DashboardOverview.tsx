import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichRechnungsverwaltung, enrichRechnungspositionen, enrichProjektverwaltung } from '@/lib/enrich';
import type { EnrichedRechnungsverwaltung } from '@/types/enriched';
import type { Rechnungsverwaltung, Rechnungspositionen, Projektverwaltung, Leistungskatalog, Kundenverwaltung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard } from '@/components/widgets/KanbanWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import type { ChartRow } from '@/components/widgets/ChartWidget';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
} from '@/components/widgets/RecordView';
import { RechnungsverwaltungDetails } from '@/components/details/RechnungsverwaltungDetails';
import { ProjektverwaltungDetails } from '@/components/details/ProjektverwaltungDetails';
import { KundenverwaltungDetails } from '@/components/details/KundenverwaltungDetails';
import { RechnungspositionenDetails } from '@/components/details/RechnungspositionenDetails';
import { RechnungsverwaltungDialog } from '@/components/dialogs/RechnungsverwaltungDialog';
import type { RechnungsverwaltungDialogDefaults } from '@/components/dialogs/RechnungsverwaltungDialog';
import { ProjektverwaltungDialog } from '@/components/dialogs/ProjektverwaltungDialog';
import { RechnungspositionenDialog } from '@/components/dialogs/RechnungspositionenDialog';
import type { RechnungspositionenDialogDefaults } from '@/components/dialogs/RechnungspositionenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { format } from 'date-fns';
import {
  IconAlertTriangle, IconFileInvoice, IconPlus, IconBuildingStore,
  IconChecks, IconSend, IconCurrencyEuro,
} from '@tabler/icons-react';

type OverlayItem =
  | { type: 'rechnung'; record: EnrichedRechnungsverwaltung }
  | { type: 'projekt'; record: Projektverwaltung }
  | { type: 'kunde'; record: Kundenverwaltung }
  | { type: 'position'; record: Rechnungspositionen };

export default function DashboardOverview() {
  const clock = useClock();

  const {
    rechnungsverwaltung, rechnungspositionen, projektverwaltung, leistungskatalog, kundenverwaltung,
    rechnungsverwaltungMap, projektverwaltungMap, leistungskatalogMap, kundenverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedRechnungsverwaltung = enrichRechnungsverwaltung(rechnungsverwaltung, { projektverwaltungMap, kundenverwaltungMap });
  const enrichedRechnungspositionen = enrichRechnungspositionen(rechnungspositionen, { rechnungsverwaltungMap, leistungskatalogMap });
  const enrichedProjektverwaltung = enrichProjektverwaltung(projektverwaltung, { kundenverwaltungMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  const [rechnungDialogOpen, setRechnungDialogOpen] = useState(false);
  const [rechnungDefaults, setRechnungDefaults] = useState<RechnungsverwaltungDialogDefaults | undefined>();
  const [editingRechnung, setEditingRechnung] = useState<EnrichedRechnungsverwaltung | null>(null);

  const [projektDialogOpen, setProjektDialogOpen] = useState(false);
  const [editingProjekt, setEditingProjekt] = useState<Projektverwaltung | null>(null);

  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [positionDefaults, setPositionDefaults] = useState<RechnungspositionenDialogDefaults | undefined>();
  const [editingPosition, setEditingPosition] = useState<Rechnungspositionen | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'rechnung' } | null>(null);

  const today = format(clock, 'yyyy-MM-dd');

  const ueberfaellige = useMemo(
    () => enrichedRechnungsverwaltung.filter(r =>
      r.fields.rechnungsstatus?.key === 'ueberfaellig' ||
      (r.fields.faelligkeitsdatum && r.fields.faelligkeitsdatum < today &&
        r.fields.rechnungsstatus?.key !== 'bezahlt' &&
        r.fields.rechnungsstatus?.key !== 'storniert')
    ),
    [enrichedRechnungsverwaltung, today]
  );

  const offeneRechnungen = useMemo(
    () => enrichedRechnungsverwaltung.filter(r =>
      r.fields.rechnungsstatus?.key === 'versendet' || r.fields.rechnungsstatus?.key === 'ueberfaellig'
    ),
    [enrichedRechnungsverwaltung]
  );

  const gesamtOffenBrutto = useMemo(
    () => offeneRechnungen.reduce((sum, r) => sum + (r.fields.bruttobetrag ?? 0), 0),
    [offeneRechnungen]
  );

  const aktiveProjekte = useMemo(
    () => projektverwaltung.filter(p => p.fields.projektstatus?.key === 'aktiv'),
    [projektverwaltung]
  );

  const chartRows: ChartRow<Rechnungsverwaltung>[] = useMemo(
    () => rechnungsverwaltung.map(r => ({ id: `rechnung:${r.record_id}`, data: r })),
    [rechnungsverwaltung]
  );

  // ─── Every hook goes ABOVE this line ────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Plain derivations only below ───────────────────────────────────────

  const statusColumns = (LOOKUP_OPTIONS['rechnungsverwaltung']?.['rechnungsstatus'] ?? []).map(o => ({
    key: o.key,
    label: o.label,
    tone: (o.key === 'bezahlt' ? 'success'
      : o.key === 'ueberfaellig' ? 'destructive'
      : o.key === 'storniert' ? 'warning'
      : 'default') as 'success' | 'destructive' | 'warning' | 'default',
  }));

  const kanbanCards: KanbanCard[] = enrichedRechnungsverwaltung
    .sort((a, b) => (a.fields.faelligkeitsdatum ?? '') < (b.fields.faelligkeitsdatum ?? '') ? -1 : 1)
    .map(r => ({
      id: `rechnung:${r.record_id}`,
      column: r.fields.rechnungsstatus?.key ?? '',
      title: r.fields.rechnungsnummer ?? '—',
      subtitle: [
        r.kundeName ?? r.fields.bestellnummer,
        r.fields.bruttobetrag != null ? formatCurrency(r.fields.bruttobetrag) : null,
      ].filter(Boolean).join(' · '),
      tone: (r.fields.rechnungsstatus?.key === 'ueberfaellig' ? 'destructive'
        : r.fields.rechnungsstatus?.key === 'bezahlt' ? 'success'
        : 'default') as 'destructive' | 'success' | 'default',
    }));

  async function handleCardMove(cardId: string, newColumn: string): Promise<void | string> {
    const id = cardId.split(':')[1];
    const rec = enrichedRechnungsverwaltung.find(r => r.record_id === id);
    if (!rec) return;
    const oldStatus = rec.fields.rechnungsstatus;
    // Optimistic update
    const updated = enrichedRechnungsverwaltung.map(r =>
      r.record_id === id
        ? { ...r, fields: { ...r.fields, rechnungsstatus: { key: newColumn, label: statusColumns.find(c => c.key === newColumn)?.label ?? newColumn } } }
        : r
    );
    // We can't directly set enriched state, but we call fetchAll on error
    try {
      await LivingAppsService.updateRechnungsverwaltungEntry(id, { rechnungsstatus: newColumn });
      undoToast(`Status auf "${statusColumns.find(c => c.key === newColumn)?.label ?? newColumn}" gesetzt`, async () => {
        await LivingAppsService.updateRechnungsverwaltungEntry(id, { rechnungsstatus: oldStatus?.key ?? '' });
        fetchAll();
      });
    } catch {
      fetchAll();
    }
  }

  async function handleMarkBezahlt(r: EnrichedRechnungsverwaltung) {
    const oldStatus = r.fields.rechnungsstatus;
    try {
      await LivingAppsService.updateRechnungsverwaltungEntry(r.record_id, { rechnungsstatus: 'bezahlt' });
      undoToast(`${r.fields.rechnungsnummer ?? 'Rechnung'} als bezahlt markiert`, async () => {
        await LivingAppsService.updateRechnungsverwaltungEntry(r.record_id, { rechnungsstatus: oldStatus?.key ?? '' });
        fetchAll();
      });
      fetchAll();
    } catch {
      fetchAll();
    }
  }

  const contextLine = enrichedRechnungsverwaltung.length === 0
    ? 'Lege deine erste Rechnung an, um loszulegen.'
    : ueberfaellige.length > 0
    ? `${ueberfaellige.length} Rechnung${ueberfaellige.length === 1 ? '' : 'en'} überfällig — ${namen(ueberfaellige.map(r => r.kundeName ?? r.fields.rechnungsnummer ?? '').filter(Boolean))}.`
    : `${offeneRechnungen.length} offene Rechnung${offeneRechnungen.length === 1 ? '' : 'en'} · ${formatCurrency(gesamtOffenBrutto)} ausstehend.`;

  return (
    <>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">{gruss(clock)}</h1>
            <p className="text-muted-foreground mt-1">{contextLine}</p>
          </div>
          <button
            onClick={() => { setEditingRechnung(null); setRechnungDefaults(undefined); setRechnungDialogOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shrink-0"
          >
            <IconPlus size={16} className="shrink-0" />
            Neue Rechnung
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ueberfaellige.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{ label: 'Als bezahlt markieren', onClick: () => handleMarkBezahlt(ueberfaellige[0]) }}
          >
            <b>{namen(ueberfaellige.map(r => r.kundeName ?? r.fields.rechnungsnummer ?? '').filter(Boolean))}</b> — {ueberfaellige.length === 1 ? 'Rechnung überfällig' : `${ueberfaellige.length} Rechnungen überfällig`}. Fällig war {formatDate(ueberfaellige[0].fields.faelligkeitsdatum ?? '')}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Offen"
              value={offeneRechnungen.length}
              icon={<IconFileInvoice size={16} className="shrink-0" />}
              tone={offeneRechnungen.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Ausstehend"
              value={formatCurrency(gesamtOffenBrutto)}
              icon={<IconCurrencyEuro size={16} className="shrink-0" />}
              tone={gesamtOffenBrutto > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Überfällig"
              value={ueberfaellige.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={ueberfaellige.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title="Aktive Projekte"
              value={aktiveProjekte.length}
              icon={<IconBuildingStore size={16} className="shrink-0" />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={statusColumns}
            cards={kanbanCards}
            defaultCollapsed={['storniert']}
            onCardClick={card => {
              const id = card.id.split(':')[1];
              const rec = enrichedRechnungsverwaltung.find(r => r.record_id === id);
              if (rec) overlay.replace({ type: 'rechnung', record: rec });
            }}
            onCardMove={handleCardMove}
            onAddCard={columnKey => {
              setEditingRechnung(null);
              setRechnungDefaults({ rechnungsstatus: columnKey });
              setRechnungDialogOpen(true);
            }}
          />
        }
        aside={
          <>
            <WorkList
              title="Überfällig & offen"
              items={[...ueberfaellige, ...offeneRechnungen.filter(r => r.fields.rechnungsstatus?.key !== 'ueberfaellig')]
                .slice(0, 8)
                .map(r => ({
                  id: r.record_id,
                  title: `${r.fields.rechnungsnummer ?? '—'} · ${r.kundeName ?? '—'}`,
                  secondLine: (
                    <>
                      <span className={r.fields.rechnungsstatus?.key === 'ueberfaellig' ? 'font-medium text-destructive' : 'font-medium text-warning'}>
                        {r.fields.rechnungsstatus?.label ?? '—'}
                      </span>
                      {r.fields.faelligkeitsdatum && (
                        <span className="text-muted-foreground"> · fällig {formatDate(r.fields.faelligkeitsdatum)}</span>
                      )}
                    </>
                  ),
                  action: r.fields.rechnungsstatus?.key !== 'bezahlt'
                    ? { label: '✓ Bezahlt', onClick: () => handleMarkBezahlt(r) }
                    : undefined,
                }))}
              onItemClick={id => {
                const rec = enrichedRechnungsverwaltung.find(r => r.record_id === id);
                if (rec) overlay.replace({ type: 'rechnung', record: rec });
              }}
              empty={{
                text: 'Alle Rechnungen im Plan — keine offenen Posten.',
                action: { label: 'Neue Rechnung', onClick: () => { setEditingRechnung(null); setRechnungDefaults(undefined); setRechnungDialogOpen(true); } },
              }}
            />
            <ChartWidget
              title="Umsatz nach Monat"
              rows={chartRows}
              dimension={{ kind: 'time', accessor: row => row.data.fields.rechnungsdatum ?? null, bucket: 'month' }}
              measure={{ aggregate: 'sum', label: 'Brutto', value: row => row.data.fields.bruttobetrag ?? null, format: 'currency' }}
              timeEnd={format(clock, "yyyy-MM-dd")}
              locale="de"
            />
          </>
        }
      />

      {/* Dialoge */}
      <RechnungsverwaltungDialog
        open={rechnungDialogOpen}
        onClose={() => { setRechnungDialogOpen(false); setEditingRechnung(null); }}
        onSubmit={async fields => {
          if (editingRechnung) {
            await LivingAppsService.updateRechnungsverwaltungEntry(editingRechnung.record_id, fields);
          } else {
            await LivingAppsService.createRechnungsverwaltungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingRechnung?.fields ?? rechnungDefaults}
        recordId={editingRechnung?.record_id}
        projektverwaltungList={projektverwaltung}
        kundenverwaltungList={kundenverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Rechnungsverwaltung']}
      />

      <ProjektverwaltungDialog
        open={projektDialogOpen}
        onClose={() => { setProjektDialogOpen(false); setEditingProjekt(null); }}
        onSubmit={async fields => {
          if (editingProjekt) {
            await LivingAppsService.updateProjektverwaltungEntry(editingProjekt.record_id, fields);
          } else {
            await LivingAppsService.createProjektverwaltungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingProjekt?.fields}
        recordId={editingProjekt?.record_id}
        kundenverwaltungList={kundenverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Projektverwaltung']}
      />

      <RechnungspositionenDialog
        open={positionDialogOpen}
        onClose={() => { setPositionDialogOpen(false); setEditingPosition(null); }}
        onSubmit={async fields => {
          if (editingPosition) {
            await LivingAppsService.updateRechnungspositionenEntry(editingPosition.record_id, fields);
          } else {
            await LivingAppsService.createRechnungspositionenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingPosition?.fields ?? positionDefaults}
        recordId={editingPosition?.record_id}
        rechnungsverwaltungList={rechnungsverwaltung}
        leistungskatalogList={leistungskatalog}
        enablePhotoScan={AI_PHOTO_SCAN['Rechnungspositionen']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Rechnung löschen"
        description="Diese Rechnung wirklich löschen? Alle zugehörigen Positionen bleiben erhalten."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await LivingAppsService.deleteRechnungsverwaltungEntry(deleteTarget.id);
          fetchAll();
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Overlay Stack */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'rechnung') {
            const r = top.record;
            return (
              <>
                <RecordHeader
                  title={r.fields.rechnungsnummer ?? '—'}
                  subtitle={[r.kundeName, r.fields.rechnungsstatus?.label].filter(Boolean).join(' · ')}
                  badges={r.fields.bruttobetrag != null ? <span className="text-sm font-medium">{formatCurrency(r.fields.bruttobetrag)}</span> : undefined}
                />
                <RechnungsverwaltungDetails
                  record={r}
                  projektverwaltungList={projektverwaltung}
                  kundenverwaltungList={kundenverwaltung}
                  rechnungspositionenList={rechnungspositionen}
                  onOpenProjektverwaltung={proj => overlay.push({ type: 'projekt', record: proj })}
                  onOpenKundenverwaltung={k => overlay.push({ type: 'kunde', record: k })}
                  onOpenRechnungspositionen={pos => overlay.push({ type: 'position', record: pos })}
                  onAddRechnungspositionen={() => {
                    setPositionDefaults({ rechnung: r.record_id });
                    setEditingPosition(null);
                    setPositionDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'projekt') {
            const p = top.record;
            return (
              <>
                <RecordHeader
                  title={p.fields.projektname ?? '—'}
                  subtitle={[p.fields.projektnummer, p.fields.projektstatus?.label].filter(Boolean).join(' · ')}
                />
                <ProjektverwaltungDetails
                  record={p}
                  kundenverwaltungList={kundenverwaltung}
                  rechnungsverwaltungList={rechnungsverwaltung}
                  onOpenKundenverwaltung={k => overlay.push({ type: 'kunde', record: k })}
                  onOpenRechnungsverwaltung={r => {
                    const enriched = enrichedRechnungsverwaltung.find(e => e.record_id === r.record_id);
                    if (enriched) overlay.push({ type: 'rechnung', record: enriched });
                  }}
                  onAddRechnungsverwaltung={() => {
                    setRechnungDefaults({ projekt: p.record_id });
                    setEditingRechnung(null);
                    setRechnungDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'kunde') {
            const k = top.record;
            return (
              <>
                <RecordHeader
                  title={k.fields.firmenname ?? '—'}
                  subtitle={[k.fields.ansprechpartner_vorname, k.fields.ansprechpartner_nachname].filter(Boolean).join(' ')}
                />
                <KundenverwaltungDetails
                  record={k}
                  rechnungsverwaltungList={rechnungsverwaltung}
                  projektverwaltungList={projektverwaltung}
                  onOpenRechnungsverwaltung={r => {
                    const enriched = enrichedRechnungsverwaltung.find(e => e.record_id === r.record_id);
                    if (enriched) overlay.push({ type: 'rechnung', record: enriched });
                  }}
                  onAddRechnungsverwaltung={() => {
                    setRechnungDefaults({ kunde: k.record_id });
                    setEditingRechnung(null);
                    setRechnungDialogOpen(true);
                  }}
                  onOpenProjektverwaltung={p => overlay.push({ type: 'projekt', record: p })}
                  onAddProjektverwaltung={() => {
                    setEditingProjekt(null);
                    setProjektDialogOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'position') {
            const pos = top.record;
            return (
              <>
                <RecordHeader
                  title={pos.fields.positionsbeschreibung ?? `Position ${pos.fields.positionsnummer ?? ''}`}
                  subtitle={[pos.fields.menge, pos.fields.einheit?.label].filter(Boolean).join(' ')}
                />
                <RechnungspositionenDetails
                  record={pos}
                  rechnungsverwaltungList={rechnungsverwaltung}
                  leistungskatalogList={leistungskatalog}
                  onOpenRechnungsverwaltung={r => {
                    const enriched = enrichedRechnungsverwaltung.find(e => e.record_id === r.record_id);
                    if (enriched) overlay.push({ type: 'rechnung', record: enriched });
                  }}
                  onOpenLeistungskatalog={_l => {}}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={top => {
          if (top.type === 'rechnung') {
            setEditingRechnung(top.record);
            setRechnungDefaults(undefined);
            setRechnungDialogOpen(true);
          } else if (top.type === 'projekt') {
            setEditingProjekt(top.record);
            setProjektDialogOpen(true);
          } else if (top.type === 'position') {
            setEditingPosition(top.record);
            setPositionDefaults(undefined);
            setPositionDialogOpen(true);
          }
        }}
        footer={top => {
          if (top.type === 'rechnung') {
            const r = top.record;
            const nextStatus = r.fields.rechnungsstatus?.key === 'entwurf' ? { key: 'versendet', label: 'Versendet' }
              : r.fields.rechnungsstatus?.key === 'versendet' ? { key: 'bezahlt', label: 'Bezahlt' }
              : null;
            if (!nextStatus) return undefined;
            return {
              label: nextStatus.key === 'versendet' ? 'Als versendet markieren' : 'Als bezahlt markieren',
              onClick: async () => {
                const oldStatus = r.fields.rechnungsstatus;
                await LivingAppsService.updateRechnungsverwaltungEntry(r.record_id, { rechnungsstatus: nextStatus.key });
                undoToast(`Status: ${nextStatus.label}`, async () => {
                  await LivingAppsService.updateRechnungsverwaltungEntry(r.record_id, { rechnungsstatus: oldStatus?.key ?? '' });
                  fetchAll();
                });
                fetchAll();
              },
            };
          }
          return undefined;
        }}
      />
    </>
  );
}
