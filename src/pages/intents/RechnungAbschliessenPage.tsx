/**
 * Rechnung abschließen — 2-Schritt-Wizard.
 * Steps: 1) Offene Rechnung wählen (entwurf|versendet) → 2) Status setzen (bezahlt|storniert) & speichern.
 * Reads: rechnungsverwaltung (enriched → kundeName). Writes: rechnungsverwaltung (updateRechnungsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { EnrichedRechnungsverwaltung } from '@/types/enriched';
import { enrichRechnungsverwaltung } from '@/lib/enrich';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate, formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  IconFileInvoice,
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
} from '@tabler/icons-react';

const WIZARD_STEPS = [{ label: 'Rechnung wählen' }, { label: 'Status setzen' }];

const STATUS_FINAL = [
  { key: 'bezahlt', label: 'Bezahlt' },
  { key: 'storniert', label: 'Storniert' },
] as const;

type FinalStatus = 'bezahlt' | 'storniert';

export default function RechnungAbschliessenPage() {
  const { rechnungsverwaltung, kundenverwaltungMap, projektverwaltungMap, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedRechnung, setSelectedRechnung] = useState<EnrichedRechnungsverwaltung | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<FinalStatus>('bezahlt');
  const [notizen, setNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Enrichment
  const enriched = enrichRechnungsverwaltung(rechnungsverwaltung, { kundenverwaltungMap, projektverwaltungMap });

  // Filter: only entwurf or versendet
  const eligibleRechnungen = enriched.filter(r => {
    const key = lookupKey(r.fields.rechnungsstatus);
    return key != null && ['entwurf', 'versendet'].includes(key);
  });

  // Step 1: select invoice
  const handleSelect = (id: string) => {
    const found = enriched.find(r => r.record_id === id);
    if (!found) return;
    setSelectedRechnung(found);
    setStep(2);
  };

  // Step 2: submit
  const handleSubmit = async () => {
    if (!selectedRechnung) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = { rechnungsstatus: selectedStatus };
      if (selectedStatus === 'storniert' && notizen.trim()) {
        payload.notizen = notizen.trim();
      }
      await LivingAppsService.updateRechnungsverwaltungEntry(selectedRechnung.record_id, payload);
      await fetchAll();
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Speichern.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedRechnung(null);
    setSelectedStatus('bezahlt');
    setNotizen('');
    setSubmitError(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title="Rechnung abschließen"
      subtitle="Offene Rechnung als bezahlt oder storniert markieren"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Rechnung wählen ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wähle eine offene Rechnung aus, die du abschließen möchtest.
          </p>
          {eligibleRechnungen.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <IconFileInvoice size={48} className="text-muted-foreground opacity-40" stroke={1.5} />
              <p className="text-sm text-muted-foreground">
                Keine offenen Rechnungen vorhanden. Alle Rechnungen sind bereits abgeschlossen.
              </p>
              <a href="#/" className="text-sm text-primary hover:underline">Zurück zum Dashboard</a>
            </div>
          ) : (
            <EntitySelectStep
              items={eligibleRechnungen.map(r => ({
                id: r.record_id,
                title: r.fields.rechnungsnummer ?? `Rechnung ${r.record_id.slice(-6)}`,
                subtitle: [
                  r.kundeName,
                  r.fields.rechnungsdatum ? `Datum: ${formatDate(r.fields.rechnungsdatum)}` : null,
                  r.fields.faelligkeitsdatum ? `Fällig: ${formatDate(r.fields.faelligkeitsdatum)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
                status: r.fields.rechnungsstatus
                  ? { key: r.fields.rechnungsstatus.key, label: r.fields.rechnungsstatus.label }
                  : undefined,
                stats: r.fields.bruttobetrag != null
                  ? [{ label: 'Brutto', value: formatCurrency(r.fields.bruttobetrag) }]
                  : [],
                icon: <IconFileInvoice size={20} className="text-primary" stroke={1.5} />,
              }))}
              onSelect={handleSelect}
              searchPlaceholder="Rechnungsnummer oder Kunde suchen..."
              emptyIcon={<IconFileInvoice size={32} stroke={1.5} />}
              emptyText="Keine passende Rechnung gefunden."
            />
          )}
        </div>
      )}

      {/* ── Step 2: Status setzen ── */}
      {step === 2 && (
        selectedRechnung ? (
          done ? (
            // ── Success state ──
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <IconCircleCheck size={36} className="text-primary" stroke={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Rechnung abgeschlossen</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRechnung.fields.rechnungsnummer ?? 'Die Rechnung'} wurde als{' '}
                  <span className="font-medium">
                    {selectedStatus === 'bezahlt' ? 'bezahlt' : 'storniert'}
                  </span>{' '}
                  markiert.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Button onClick={handleReset} variant="outline">
                  Weitere Rechnung abschließen
                </Button>
                <a href="#/">
                  <Button>Zurück zum Dashboard</Button>
                </a>
              </div>
            </div>
          ) : (
            // ── Main step 2 content ──
            <div className="space-y-6">
              {/* Summary card */}
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <IconFileInvoice size={20} className="text-primary" stroke={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">
                        {selectedRechnung.fields.rechnungsnummer ?? `Rechnung ${selectedRechnung.record_id.slice(-6)}`}
                      </span>
                      {selectedRechnung.fields.rechnungsstatus && (
                        <StatusBadge
                          statusKey={selectedRechnung.fields.rechnungsstatus.key}
                          label={selectedRechnung.fields.rechnungsstatus.label}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedRechnung.kundeName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {selectedRechnung.fields.bruttobetrag != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bruttobetrag</p>
                      <p className="font-semibold">{formatCurrency(selectedRechnung.fields.bruttobetrag)}</p>
                    </div>
                  )}
                  {selectedRechnung.fields.rechnungsdatum && (
                    <div>
                      <p className="text-xs text-muted-foreground">Rechnungsdatum</p>
                      <p className="font-medium">{formatDate(selectedRechnung.fields.rechnungsdatum)}</p>
                    </div>
                  )}
                  {selectedRechnung.fields.faelligkeitsdatum && (
                    <div>
                      <p className="text-xs text-muted-foreground">Fälligkeitsdatum</p>
                      <p className="font-medium">{formatDate(selectedRechnung.fields.faelligkeitsdatum)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status picker */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Neuer Status *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STATUS_FINAL.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedStatus(opt.key)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                        selectedStatus === opt.key
                          ? opt.key === 'bezahlt'
                            ? 'border-green-500 bg-green-50'
                            : 'border-red-400 bg-red-50'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        opt.key === 'bezahlt' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {opt.key === 'bezahlt'
                          ? <IconCircleCheck size={20} className="text-green-600" stroke={1.5} />
                          : <IconCircleX size={20} className="text-red-500" stroke={1.5} />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.key === 'bezahlt'
                            ? 'Zahlung wurde eingegangen'
                            : 'Rechnung wird storniert'}
                        </p>
                      </div>
                      {selectedStatus === opt.key && (
                        <IconCircleCheck size={16} className={`ml-auto shrink-0 ${opt.key === 'bezahlt' ? 'text-green-600' : 'text-red-500'}`} stroke={2.5} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notizen — only shown for storniert */}
              {selectedStatus === 'storniert' && (
                <div className="space-y-2">
                  <Label htmlFor="notizen" className="text-sm font-medium">
                    Stornogrund <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="notizen"
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder="Grund für die Stornierung..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}

              {/* Error message */}
              {submitError && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <IconAlertTriangle size={16} className="shrink-0 mt-0.5" stroke={2} />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                  Zurück
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={selectedStatus === 'storniert' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}
                >
                  {submitting
                    ? 'Wird gespeichert...'
                    : selectedStatus === 'bezahlt'
                    ? 'Als bezahlt markieren'
                    : 'Rechnung stornieren'}
                </Button>
              </div>
            </div>
          )
        ) : (
          // Fallback when arriving at step 2 without a selection (e.g. deep link ?step=2)
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt eine ausgewählte Rechnung aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
