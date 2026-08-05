/**
 * Neue Rechnung — 4-Schritt-Wizard.
 * Steps: 1) Kunde wählen → 2) Projekt wählen (optional) → 3) Rechnungskopf erfassen → 4) Positionen hinzufügen.
 * Reads: kundenverwaltung, projektverwaltung, leistungskatalog.
 * Writes: rechnungsverwaltung (createRechnungsverwaltungEntry), rechnungspositionen (createRechnungspositionenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge, BudgetTracker.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Kundenverwaltung, Projektverwaltung, Leistungskatalog } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  IconBuilding,
  IconFolderOpen,
  IconFileInvoice,
  IconPlus,
  IconTrash,
  IconCheck,
  IconChevronRight,
  IconArrowRight,
  IconSearch,
} from '@tabler/icons-react';

const ZAHLUNGSBEDINGUNGEN = LOOKUP_OPTIONS['rechnungsverwaltung']?.['zahlungsbedingungen'] ?? [];
const STEUERSATZ_OPTIONS = LOOKUP_OPTIONS['rechnungsverwaltung']?.['steuersatz'] ?? [];
const WAEHRUNG_OPTIONS = LOOKUP_OPTIONS['rechnungsverwaltung']?.['waehrung'] ?? [];
const EINHEIT_OPTIONS = LOOKUP_OPTIONS['rechnungspositionen']?.['einheit'] ?? [];

interface PositionRow {
  id: string;
  positionsbeschreibung: string;
  menge: string;
  einheitKey: string;
  einzelpreis: string;
  positionsnummer: string;
  rabatt_prozent: string;
  selectedLeistungId?: string;
}

function newPosition(idx: number): PositionRow {
  return {
    id: `pos-${Date.now()}-${idx}`,
    positionsbeschreibung: '',
    menge: '1',
    einheitKey: EINHEIT_OPTIONS[0]?.key ?? 'stunde',
    einzelpreis: '',
    positionsnummer: String(idx + 1),
    rabatt_prozent: '',
    selectedLeistungId: undefined,
  };
}

export default function NeueRechnungPage() {
  const { kundenverwaltung, projektverwaltung, leistungskatalog, loading, error, fetchAll } =
    useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1
  const [selectedKundeId, setSelectedKundeId] = useState<string | undefined>();

  // Step 2
  const [selectedProjektId, setSelectedProjektId] = useState<string | undefined>();

  // Step 3
  const [rechnungsnummer, setRechnungsnummer] = useState('');
  const [rechnungsdatum, setRechnungsdatum] = useState('');
  const [faelligkeitsdatum, setFaelligkeitsdatum] = useState('');
  const [zahlungsbedingungenKey, setZahlungsbedingungenKey] = useState(
    ZAHLUNGSBEDINGUNGEN[0]?.key ?? 'netto_30'
  );
  const [steuersatzKey, setSteuersatzKey] = useState(STEUERSATZ_OPTIONS[0]?.key ?? 'steuersatz_19');
  const [waehrungKey, setWaehrungKey] = useState(WAEHRUNG_OPTIONS[0]?.key ?? 'eur');
  const [leistungszeitraum_von, setLeistungszeitraumVon] = useState('');
  const [leistungszeitraum_bis, setLeistungszeitraumBis] = useState('');
  const [bestellnummer, setBestellnummer] = useState('');
  const [notizen, setNotizen] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | undefined>();

  // Step 4
  const [rechnungId, setRechnungId] = useState<string | undefined>();
  const [positions, setPositions] = useState<PositionRow[]>([newPosition(0)]);
  const [savingPositions, setSavingPositions] = useState(false);
  const [positionError, setPositionError] = useState<string | undefined>();
  const [savedPositionIds, setSavedPositionIds] = useState<string[]>([]);
  const [leistungSearch, setLeistungSearch] = useState('');
  const [done, setDone] = useState(false);

  // Derived data
  const selectedKunde = kundenverwaltung.find((k: Kundenverwaltung) => k.record_id === selectedKundeId);

  const filteredProjekte = (() => {
    if (!selectedKundeId) return projektverwaltung;
    const matching = projektverwaltung.filter(
      (p: Projektverwaltung) => extractRecordId(p.fields.kunde) === selectedKundeId
    );
    return matching.length > 0 ? matching : projektverwaltung;
  })();

  const filteredLeistungen = leistungskatalog.filter((l: Leistungskatalog) => {
    if (!leistungSearch) return true;
    const q = leistungSearch.toLowerCase();
    return (
      l.fields.leistungsbezeichnung?.toLowerCase().includes(q) ||
      l.fields.leistungsbeschreibung?.toLowerCase().includes(q)
    );
  });

  // Running total for step 4
  const runningTotal = positions.reduce((sum, pos) => {
    const menge = parseFloat(pos.menge) || 0;
    const einzelpreis = parseFloat(pos.einzelpreis) || 0;
    const rabatt = parseFloat(pos.rabatt_prozent) || 0;
    const line = menge * einzelpreis * (1 - rabatt / 100);
    return sum + line;
  }, 0);

  // Step 3: save header
  const handleSaveHeader = async () => {
    if (!rechnungsnummer || !rechnungsdatum || !selectedKundeId) return;
    setSavingHeader(true);
    setHeaderError(undefined);
    try {
      let pid = rechnungId;
      if (!pid) {
        const result = await LivingAppsService.createRechnungsverwaltungEntry({
          rechnungsnummer,
          rechnungsdatum,
          ...(faelligkeitsdatum ? { faelligkeitsdatum } : {}),
          zahlungsbedingungen: zahlungsbedingungenKey,
          steuersatz: steuersatzKey,
          waehrung: waehrungKey,
          ...(leistungszeitraum_von ? { leistungszeitraum_von } : {}),
          ...(leistungszeitraum_bis ? { leistungszeitraum_bis } : {}),
          ...(bestellnummer ? { bestellnummer } : {}),
          ...(notizen ? { notizen } : {}),
          rechnungsstatus: 'entwurf',
          kunde: createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId),
          ...(selectedProjektId
            ? { projekt: createRecordUrl(APP_IDS.PROJEKTVERWALTUNG, selectedProjektId) }
            : {}),
        });
        pid = result.record_id;
        setRechnungId(pid);
      }
      await fetchAll();
      setStep(4);
    } catch {
      setHeaderError('Fehler beim Speichern der Rechnung. Bitte erneut versuchen.');
    } finally {
      setSavingHeader(false);
    }
  };

  // Step 4: pre-fill position from Leistungskatalog
  const applyLeistung = (posId: string, leistung: Leistungskatalog) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.id === posId
          ? {
              ...p,
              positionsbeschreibung:
                leistung.fields.leistungsbezeichnung ?? p.positionsbeschreibung,
              einzelpreis: leistung.fields.standardpreis != null
                ? String(leistung.fields.standardpreis)
                : p.einzelpreis,
              einheitKey: leistung.fields.einheit?.key ?? p.einheitKey,
              selectedLeistungId: leistung.record_id,
            }
          : p
      )
    );
  };

  const updatePosition = (posId: string, field: keyof PositionRow, value: string) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === posId ? { ...p, [field]: value } : p))
    );
  };

  const addPosition = () => {
    setPositions((prev) => [...prev, newPosition(prev.length)]);
  };

  const removePosition = (posId: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== posId));
  };

  // Step 4: save all positions
  const handleSavePositions = async () => {
    if (!rechnungId) return;
    setSavingPositions(true);
    setPositionError(undefined);
    try {
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const menge = parseFloat(pos.menge);
        const einzelpreis = parseFloat(pos.einzelpreis);
        if (!pos.positionsbeschreibung || isNaN(menge) || isNaN(einzelpreis)) continue;

        const result = await LivingAppsService.createRechnungspositionenEntry({
          rechnung: createRecordUrl(APP_IDS.RECHNUNGSPOSITIONEN, rechnungId),
          positionsbeschreibung: pos.positionsbeschreibung,
          menge,
          einheit: pos.einheitKey !== 'none' ? pos.einheitKey : undefined,
          einzelpreis,
          ...(pos.positionsnummer ? { positionsnummer: parseInt(pos.positionsnummer, 10) } : {}),
          ...(pos.rabatt_prozent && pos.rabatt_prozent !== '0'
            ? { rabatt_prozent: parseFloat(pos.rabatt_prozent) }
            : {}),
          ...(pos.selectedLeistungId
            ? { leistung: createRecordUrl(APP_IDS.LEISTUNGSKATALOG, pos.selectedLeistungId) }
            : {}),
        });
        setSavedPositionIds((prev) => [...prev, result.record_id]);
      }
      await fetchAll();
      setDone(true);
    } catch {
      setPositionError('Fehler beim Speichern der Positionen. Bitte erneut versuchen.');
    } finally {
      setSavingPositions(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedKundeId(undefined);
    setSelectedProjektId(undefined);
    setRechnungsnummer('');
    setRechnungsdatum('');
    setFaelligkeitsdatum('');
    setZahlungsbedingungenKey(ZAHLUNGSBEDINGUNGEN[0]?.key ?? 'netto_30');
    setSteuersatzKey(STEUERSATZ_OPTIONS[0]?.key ?? 'steuersatz_19');
    setWaehrungKey(WAEHRUNG_OPTIONS[0]?.key ?? 'eur');
    setLeistungszeitraumVon('');
    setLeistungszeitraumBis('');
    setBestellnummer('');
    setNotizen('');
    setRechnungId(undefined);
    setPositions([newPosition(0)]);
    setSavedPositionIds([]);
    setDone(false);
    setHeaderError(undefined);
    setPositionError(undefined);
  };

  return (
    <IntentWizardShell
      title="Neue Rechnung"
      subtitle="Rechnung Schritt für Schritt anlegen und mit Positionen befüllen"
      steps={[
        { label: 'Kunde' },
        { label: 'Projekt' },
        { label: 'Rechnungskopf' },
        { label: 'Positionen' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Kunde wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={kundenverwaltung.map((k: Kundenverwaltung) => ({
            id: k.record_id,
            title: k.fields.firmenname ?? '(Kein Name)',
            subtitle:
              [k.fields.ansprechpartner_vorname, k.fields.ansprechpartner_nachname]
                .filter(Boolean)
                .join(' ') || undefined,
            icon: <IconBuilding size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedKundeId(id);
            setSelectedProjektId(undefined);
            setStep(2);
          }}
          searchPlaceholder="Kunden suchen …"
          emptyText="Keine Kunden gefunden"
        />
      )}

      {/* ── Step 2: Projekt wählen oder überspringen ── */}
      {step === 2 && (
        selectedKundeId ? (
          <div className="space-y-4">
            {selectedKunde && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconBuilding size={14} className="shrink-0" />
                <span>Kunde: <strong className="text-foreground">{selectedKunde.fields.firmenname}</strong></span>
              </div>
            )}
            <EntitySelectStep
              items={filteredProjekte.map((p: Projektverwaltung) => ({
                id: p.record_id,
                title: p.fields.projektname ?? '(Kein Name)',
                subtitle: p.fields.projektnummer
                  ? `Nr. ${p.fields.projektnummer}`
                  : undefined,
                status: p.fields.projektstatus
                  ? { key: p.fields.projektstatus.key, label: p.fields.projektstatus.label }
                  : undefined,
                icon: <IconFolderOpen size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedProjektId(id);
                setStep(3);
              }}
              searchPlaceholder="Projekt suchen …"
              emptyText="Keine Projekte gefunden"
            />
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedProjektId(undefined);
                  setStep(3);
                }}
              >
                Ohne Projekt weiter
                <IconChevronRight size={16} className="ml-1 shrink-0" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Step 3: Rechnungskopf ── */}
      {step === 3 && (
        selectedKundeId ? (
          <div className="space-y-6">
            {selectedKunde && (
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <IconBuilding size={14} className="shrink-0" />
                  <strong className="text-foreground">{selectedKunde.fields.firmenname}</strong>
                </span>
                {selectedProjektId && (() => {
                  const proj = projektverwaltung.find(
                    (p: Projektverwaltung) => p.record_id === selectedProjektId
                  );
                  return proj ? (
                    <span className="flex items-center gap-1">
                      <IconFolderOpen size={14} className="shrink-0" />
                      <strong className="text-foreground">{proj.fields.projektname}</strong>
                    </span>
                  ) : null;
                })()}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="rechnungsnummer">Rechnungsnummer *</Label>
                <Input
                  id="rechnungsnummer"
                  value={rechnungsnummer}
                  onChange={(e) => setRechnungsnummer(e.target.value)}
                  placeholder="z. B. RE-2026-001"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rechnungsdatum">Rechnungsdatum *</Label>
                <Input
                  id="rechnungsdatum"
                  type="date"
                  value={rechnungsdatum}
                  onChange={(e) => setRechnungsdatum(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="faelligkeitsdatum">Fälligkeitsdatum</Label>
                <Input
                  id="faelligkeitsdatum"
                  type="date"
                  value={faelligkeitsdatum}
                  onChange={(e) => setFaelligkeitsdatum(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zahlungsbedingungen">Zahlungsbedingungen</Label>
                <Select value={zahlungsbedingungenKey} onValueChange={setZahlungsbedingungenKey}>
                  <SelectTrigger id="zahlungsbedingungen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZAHLUNGSBEDINGUNGEN.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Steuersatz</Label>
                <div className="flex flex-wrap gap-2">
                  {STEUERSATZ_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSteuersatzKey(opt.key)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        steuersatzKey === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Währung</Label>
                <div className="flex flex-wrap gap-2">
                  {WAEHRUNG_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setWaehrungKey(opt.key)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        waehrungKey === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="lz_von">Leistungszeitraum von</Label>
                <Input
                  id="lz_von"
                  type="date"
                  value={leistungszeitraum_von}
                  onChange={(e) => setLeistungszeitraumVon(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lz_bis">Leistungszeitraum bis</Label>
                <Input
                  id="lz_bis"
                  type="date"
                  value={leistungszeitraum_bis}
                  onChange={(e) => setLeistungszeitraumBis(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bestellnummer">Bestellnummer</Label>
                <Input
                  id="bestellnummer"
                  value={bestellnummer}
                  onChange={(e) => setBestellnummer(e.target.value)}
                  placeholder="Optionale Bestellnummer"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notizen">Notizen</Label>
              <Textarea
                id="notizen"
                value={notizen}
                onChange={(e) => setNotizen(e.target.value)}
                placeholder="Interne Notizen zur Rechnung …"
                rows={3}
              />
            </div>

            {headerError && (
              <p className="text-sm text-destructive">{headerError}</p>
            )}

            <div className="flex justify-end">
              <Button
                disabled={!rechnungsnummer || !rechnungsdatum || savingHeader}
                onClick={handleSaveHeader}
              >
                {savingHeader ? 'Wird gespeichert …' : 'Rechnung anlegen & weiter'}
                <IconArrowRight size={16} className="ml-2 shrink-0" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Auswahl aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* ── Step 4: Positionen ── */}
      {step === 4 && (
        rechnungId ? (
          done ? (
            /* ── Erfolgszustand ── */
            <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <IconCheck size={48} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Rechnung erfolgreich angelegt!</h2>
                <p className="text-sm text-muted-foreground">
                  {savedPositionIds.length} Position{savedPositionIds.length !== 1 ? 'en' : ''} wurden gespeichert.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={handleReset}>
                  <IconPlus size={16} className="mr-2 shrink-0" />
                  Neue Rechnung anlegen
                </Button>
                <Button variant="outline" asChild>
                  <a href="#/">Zurück zum Dashboard</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Kopfzeilen-Info */}
              <div className="rounded-2xl border bg-secondary/40 p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <IconFileInvoice size={16} className="shrink-0 text-primary" />
                  <span className="font-medium">{rechnungsnummer}</span>
                  <StatusBadge statusKey="entwurf" label="Entwurf" />
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedKunde?.fields.firmenname}
                  {rechnungsdatum && ` · ${formatDate(rechnungsdatum)}`}
                </div>
              </div>

              {/* Live-Summe */}
              {runningTotal > 0 && (
                <BudgetTracker
                  budget={runningTotal}
                  booked={runningTotal}
                  label="Netto-Gesamtsumme (vorläufig)"
                  showRemaining={false}
                />
              )}

              {/* Leistungskatalog-Suche */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Vorlage aus Leistungskatalog wählen (optional — klicke auf eine Zeile um eine Position vorzubefüllen)
                </Label>
                <div className="relative">
                  <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
                  <Input
                    className="pl-8"
                    placeholder="Leistung suchen …"
                    value={leistungSearch}
                    onChange={(e) => setLeistungSearch(e.target.value)}
                  />
                </div>
                {filteredLeistungen.length > 0 && (
                  <div className="rounded-xl border divide-y max-h-48 overflow-y-auto">
                    {filteredLeistungen.map((l: Leistungskatalog) => (
                      <button
                        key={l.record_id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary transition-colors"
                        onClick={() => {
                          // Apply to the last empty position, or add a new one
                          const lastEmpty = positions.findIndex(
                            (p) => !p.positionsbeschreibung && !p.einzelpreis
                          );
                          if (lastEmpty >= 0) {
                            applyLeistung(positions[lastEmpty].id, l);
                          } else {
                            const next = newPosition(positions.length);
                            setPositions((prev) => [...prev, next]);
                            // Apply immediately in next render via timeout to have the id
                            const newId = next.id;
                            setTimeout(() => applyLeistung(newId, l), 0);
                          }
                        }}
                      >
                        <span className="text-sm font-medium truncate min-w-0">
                          {l.fields.leistungsbezeichnung}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {l.fields.standardpreis != null
                            ? `${l.fields.standardpreis} ${l.fields.waehrung?.label ?? ''}`.trim()
                            : ''}
                          {l.fields.einheit?.label ? ` / ${l.fields.einheit.label}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Positionen */}
              <div className="space-y-4">
                {positions.map((pos, idx) => (
                  <div key={pos.id} className="rounded-2xl border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Position {idx + 1}
                        {pos.selectedLeistungId && (
                          <span className="ml-2 text-xs text-primary">· Aus Katalog</span>
                        )}
                      </span>
                      {positions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePosition(pos.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Position entfernen"
                        >
                          <IconTrash size={16} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`desc-${pos.id}`}>Beschreibung *</Label>
                      <Textarea
                        id={`desc-${pos.id}`}
                        rows={2}
                        value={pos.positionsbeschreibung}
                        onChange={(e) =>
                          updatePosition(pos.id, 'positionsbeschreibung', e.target.value)
                        }
                        placeholder="Leistungsbeschreibung …"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`menge-${pos.id}`}>Menge *</Label>
                        <Input
                          id={`menge-${pos.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={pos.menge}
                          onChange={(e) => updatePosition(pos.id, 'menge', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`ep-${pos.id}`}>Einzelpreis *</Label>
                        <Input
                          id={`ep-${pos.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={pos.einzelpreis}
                          onChange={(e) => updatePosition(pos.id, 'einzelpreis', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`rabatt-${pos.id}`}>Rabatt %</Label>
                        <Input
                          id={`rabatt-${pos.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={pos.rabatt_prozent}
                          onChange={(e) => updatePosition(pos.id, 'rabatt_prozent', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`posnr-${pos.id}`}>Pos.-Nr.</Label>
                        <Input
                          id={`posnr-${pos.id}`}
                          type="number"
                          min="1"
                          value={pos.positionsnummer}
                          onChange={(e) => updatePosition(pos.id, 'positionsnummer', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Einheit *</Label>
                      <div className="flex flex-wrap gap-2">
                        {EINHEIT_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => updatePosition(pos.id, 'einheitKey', opt.key)}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                              pos.einheitKey === opt.key
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card border-border text-foreground hover:bg-secondary'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Zeilen-Summe */}
                    {pos.menge && pos.einzelpreis && (
                      <div className="text-right text-sm text-muted-foreground">
                        Gesamt:{' '}
                        <strong className="text-foreground">
                          {(
                            (parseFloat(pos.menge) || 0) *
                            (parseFloat(pos.einzelpreis) || 0) *
                            (1 - (parseFloat(pos.rabatt_prozent) || 0) / 100)
                          ).toLocaleString('de-DE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {WAEHRUNG_OPTIONS.find((w) => w.key === waehrungKey)?.label ?? ''}
                        </strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addPosition} className="w-full">
                <IconPlus size={16} className="mr-2 shrink-0" />
                Weitere Position hinzufügen
              </Button>

              {positionError && (
                <p className="text-sm text-destructive">{positionError}</p>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" asChild>
                  <a href="#/">Ohne Positionen abschließen</a>
                </Button>
                <Button
                  disabled={
                    savingPositions ||
                    positions.every(
                      (p) => !p.positionsbeschreibung || !p.menge || !p.einzelpreis
                    )
                  }
                  onClick={handleSavePositions}
                >
                  {savingPositions
                    ? 'Wird gespeichert …'
                    : `${positions.filter((p) => p.positionsbeschreibung && p.menge && p.einzelpreis).length} Position${positions.filter((p) => p.positionsbeschreibung && p.menge && p.einzelpreis).length !== 1 ? 'en' : ''} speichern`}
                  <IconCheck size={16} className="ml-2 shrink-0" />
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht eine gespeicherte Rechnung aus Schritt 3.</p>
            <Button variant="outline" onClick={() => setStep(3)}>Zurück zu Schritt 3</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
