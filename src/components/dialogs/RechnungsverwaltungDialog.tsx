/**
 * RechnungsverwaltungDialog — pre-generated create/edit dialog for Rechnungsverwaltung.
 *
 * Props: open, onClose, onSubmit(fields) => Promise<void>, defaultValues?,
 * recordId? (pass when EDITING — enables the attachments section),
 * projektverwaltungList (full hook array — resolves the Projektverwaltung applookup),
 * kundenverwaltungList (full hook array — resolves the Kundenverwaltung applookup),
 * enablePhotoScan?, enablePhotoLocation?.
 *
 * defaultValues is SHAPE-TOLERANT and its prop type is the EXPORTED
 * RechnungsverwaltungDialogDefaults — NOT the entity field type: lookup fields accept
 * the bare KEY string (or LookupValue), applookup fields the bare record id
 * (or record URL); the dialog normalizes. Type prefill STATE with the export:
 *  ❌ useState<Partial<Rechnungsverwaltung['fields']>>({ … })   // LookupValue fields reject string prefills (TS2322)
 *  ✓ useState<RechnungsverwaltungDialogDefaults | undefined>(undefined)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Rechnungsverwaltung, Projektverwaltung, Kundenverwaltung, LookupValue } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile, LivingAppsService } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Rechnungsverwaltung';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/Combobox';
import { ProjektverwaltungDialog } from '@/components/dialogs/ProjektverwaltungDialog';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconAlertCircle, IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

/** Widened prefill type for RechnungsverwaltungDialog.defaultValues — see file header. */
export type RechnungsverwaltungDialogDefaults = Omit<Rechnungsverwaltung['fields'], 'zahlungsbedingungen' | 'steuersatz' | 'waehrung' | 'rechnungsstatus'> & {
    zahlungsbedingungen?: LookupValue | string;
    steuersatz?: LookupValue | string;
    waehrung?: LookupValue | string;
    rechnungsstatus?: LookupValue | string;
  };

interface RechnungsverwaltungDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Rechnungsverwaltung['fields']) => Promise<void>;
  /** SHAPE-TOLERANT: lookup fields accept the bare key (string) or the
   *  LookupValue object; applookup fields the bare record id or the full
   *  record URL — the dialog normalizes both. */
  defaultValues?: RechnungsverwaltungDialogDefaults;
  /** Record id when editing — enables the attachments section. Omit on create. */
  recordId?: string;
  projektverwaltungList: Projektverwaltung[];
  kundenverwaltungList: Kundenverwaltung[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

// defaultValues are SHAPE-TOLERANT: the dialog resolves bare lookup keys via
// its own options and bare record ids via the field's target app — consumers
// never carry the LookupValue/record-URL shape in their head.
const NORMALIZE_LOOKUPS: Record<string, readonly { key: string; label: string }[]> = {
  zahlungsbedingungen: LOOKUP_OPTIONS['rechnungsverwaltung']?.['zahlungsbedingungen'] ?? [],
  steuersatz: LOOKUP_OPTIONS['rechnungsverwaltung']?.['steuersatz'] ?? [],
  waehrung: LOOKUP_OPTIONS['rechnungsverwaltung']?.['waehrung'] ?? [],
  rechnungsstatus: LOOKUP_OPTIONS['rechnungsverwaltung']?.['rechnungsstatus'] ?? [],
};
const NORMALIZE_APPLOOKUPS: Record<string, string> = {
  projekt: APP_IDS.PROJEKTVERWALTUNG,
  kunde: APP_IDS.KUNDENVERWALTUNG,
};
function normalizeDefaults(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [k, opts] of Object.entries(NORMALIZE_LOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = opts.find(o => o.key === v) ?? { key: v, label: v };
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' ? opts.find(o => o.key === x) ?? { key: x, label: x } : x));
  }
  for (const [k, appId] of Object.entries(NORMALIZE_APPLOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string' && v !== '' && !v.startsWith('http')) out[k] = createRecordUrl(appId, v);
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' && x !== '' && !x.startsWith('http') ? createRecordUrl(appId, x) : x));
  }
  return out;
}

export function RechnungsverwaltungDialog({ open, onClose, onSubmit, defaultValues, recordId, projektverwaltungList, kundenverwaltungList, enablePhotoScan = true, enablePhotoLocation = true }: RechnungsverwaltungDialogProps) {
  const [fields, setFields] = useState<Partial<Rechnungsverwaltung['fields']>>({});
  const [saving, setSaving] = useState(false);
  const normalizedDefaults = useMemo<Record<string, unknown> | undefined>(
    () => (defaultValues ? normalizeDefaults(defaultValues as Record<string, unknown>) : undefined),
    [defaultValues],
  );
  // Dirty-tracking: in edit-mode the Speichern button is disabled until the
  // user actually changes something. JSON.stringify is good enough for our
  // fields (plain values + LookupValue objects + string arrays).
  const isDirty = useMemo(() => {
    if (!normalizedDefaults) return true;  // create-mode: always allow submit
    try {
      return JSON.stringify(fields) !== JSON.stringify(normalizedDefaults);
    } catch {
      return true;
    }
  }, [fields, normalizedDefaults]);
  // Inline-Create state for "Projektverwaltung" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraProjektverwaltung` list, and select it in
  // the originating Combobox via the captured `createProjektverwaltungField`.
  const [createProjektverwaltungOpen, setCreateProjektverwaltungOpen] = useState(false);
  const [createProjektverwaltungInitial, setCreateProjektverwaltungInitial] = useState('');
  const [createProjektverwaltungField, setCreateProjektverwaltungField] = useState<string>('');
  const [extraProjektverwaltung, setExtraProjektverwaltung] = useState< Projektverwaltung[]>([]);
  const projektverwaltungListAll = useMemo(
    () => [...projektverwaltungList, ...extraProjektverwaltung],
    [projektverwaltungList, extraProjektverwaltung],
  );
  function openCreateProjektverwaltung(fieldKey: string, q: string) {
    setCreateProjektverwaltungField(fieldKey);
    setCreateProjektverwaltungInitial(q);
    setCreateProjektverwaltungOpen(true);
  }
  // Inline-Create state for "Kundenverwaltung" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraKundenverwaltung` list, and select it in
  // the originating Combobox via the captured `createKundenverwaltungField`.
  const [createKundenverwaltungOpen, setCreateKundenverwaltungOpen] = useState(false);
  const [createKundenverwaltungInitial, setCreateKundenverwaltungInitial] = useState('');
  const [createKundenverwaltungField, setCreateKundenverwaltungField] = useState<string>('');
  const [extraKundenverwaltung, setExtraKundenverwaltung] = useState< Kundenverwaltung[]>([]);
  const kundenverwaltungListAll = useMemo(
    () => [...kundenverwaltungList, ...extraKundenverwaltung],
    [kundenverwaltungList, extraKundenverwaltung],
  );
  function openCreateKundenverwaltung(fieldKey: string, q: string) {
    setCreateKundenverwaltungField(fieldKey);
    setCreateKundenverwaltungInitial(q);
    setCreateKundenverwaltungOpen(true);
  }
  const [showErrors, setShowErrors] = useState(false);
  const REQUIRED_FIELDS = ['rechnungsdatum', 'rechnungsstatus', 'kunde', 'rechnungsnummer'] as const;
  const missingRequired = REQUIRED_FIELDS.filter(k => {
    const v = (fields as Record<string, unknown>)[k];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
      'projekt': projektverwaltungList,
      'kunde': kundenverwaltungList,
    },
  }), [projektverwaltungList, kundenverwaltungList, ]);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults(normalizedDefaults ?? {}, formEnhancements.defaults) as Partial<Rechnungsverwaltung['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
      setSubmitError(null);
    }
  }, [open, normalizedDefaults]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  // Submit errors surface IN the dialog (it is modal — a banner in the page
  // body would be hidden behind it). A consumer onSubmit that THROWS (the
  // documented "throw to prevent closing" validation pattern) lands here:
  // the dialog stays open, nothing is saved, the message is visible.
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'rechnungsverwaltung');
      await onSubmit(clean as Rechnungsverwaltung['fields']);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="projekt" entity="Projektverwaltung">\n${JSON.stringify(projektverwaltungList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="kunde" entity="Kundenverwaltung">\n${JSON.stringify(kundenverwaltungList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "projekt": string | null, // Display name from Projektverwaltung (see <available-records>)\n  "zahlungsbedingungen": LookupValue | null, // Zahlungsbedingungen (select one key: "netto_60" | "sofort" | "netto_7" | "netto_14" | "netto_30") mapping: netto_60=60 Tage netto, sofort=Sofort fällig, netto_7=7 Tage netto, netto_14=14 Tage netto, netto_30=30 Tage netto\n  "steuersatz": LookupValue | null, // Steuersatz (select one key: "steuersatz_0" | "steuersatz_7" | "steuersatz_19") mapping: steuersatz_0=0 %, steuersatz_7=7 %, steuersatz_19=19 %\n  "nettobetrag": number | null, // Nettobetrag (€)\n  "steuerbetrag": number | null, // Steuerbetrag (€)\n  "bruttobetrag": number | null, // Bruttobetrag (€)\n  "waehrung": LookupValue | null, // Währung (select one key: "eur" | "chf" | "usd") mapping: eur=EUR, chf=CHF, usd=USD\n  "leistungszeitraum_von": string | null, // YYYY-MM-DD\n  "leistungszeitraum_bis": string | null, // YYYY-MM-DD\n  "bestellnummer": string | null, // Bestellnummer / Referenz\n  "notizen": string | null, // Bemerkungen / Notizen\n  "rechnungsdatum": string | null, // YYYY-MM-DD\n  "faelligkeitsdatum": string | null, // YYYY-MM-DD\n  "rechnungsstatus": LookupValue | null, // Rechnungsstatus (select one key: "entwurf" | "versendet" | "bezahlt" | "ueberfaellig" | "storniert") mapping: entwurf=Entwurf, versendet=Versendet, bezahlt=Bezahlt, ueberfaellig=Überfällig, storniert=Storniert\n  "kunde": string | null, // Display name from Kundenverwaltung (see <available-records>)\n  "rechnungsnummer": string | null, // Rechnungsnummer\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["projekt", "kunde"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const projektName = raw['projekt'] as string | null;
        if (projektName) {
          const projektMatch = projektverwaltungList.find(r => matchName(projektName!, [String(r.fields.projektname ?? '')]));
          if (projektMatch) merged['projekt'] = createRecordUrl(APP_IDS.PROJEKTVERWALTUNG, projektMatch.record_id);
        }
        const kundeName = raw['kunde'] as string | null;
        if (kundeName) {
          const kundeMatch = kundenverwaltungList.find(r => matchName(kundeName!, [String(r.fields.firmenname ?? '')]));
          if (kundeMatch) merged['kunde'] = createRecordUrl(APP_IDS.KUNDENVERWALTUNG, kundeMatch.record_id);
        }
        return merged as Partial<Rechnungsverwaltung['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, anhang: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Rechnungsverwaltung bearbeiten' : 'Rechnungsverwaltung hinzufügen';

  const fieldBlocks: Record<string, React.ReactNode> = {
    'projekt': (
      <div key="projekt" className="space-y-1.5">
        <Label htmlFor="projekt">Projekt</Label>
        <Combobox
          id="projekt"
          placeholder="Welches Projekt?"
          items={projektverwaltungListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.projektname ?? r.record_id),
          }))}
          value={extractRecordId(fields.projekt)}
          onChange={id => setFields(f => ({ ...f, projekt: id ? createRecordUrl(APP_IDS.PROJEKTVERWALTUNG, id) : undefined }))}
          searchPlaceholder="Suchen…"
          emptyText="Kein Treffer"
          onCreateNew={(q) => openCreateProjektverwaltung("projekt", q)}
          createLabel="Neu in Projektverwaltung"
        />
      </div>
    ),
    'zahlungsbedingungen': (
      <div key="zahlungsbedingungen" className="space-y-1.5">
        <Label htmlFor="zahlungsbedingungen">Zahlungsbedingungen</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsbedingungen) === 'netto_60'}
            onClick={() => setFields(f => ({ ...f, zahlungsbedingungen: (lookupKey(f.zahlungsbedingungen) === 'netto_60' ? undefined : 'netto_60') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsbedingungen) === 'netto_60'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            60 Tage netto
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsbedingungen) === 'sofort'}
            onClick={() => setFields(f => ({ ...f, zahlungsbedingungen: (lookupKey(f.zahlungsbedingungen) === 'sofort' ? undefined : 'sofort') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsbedingungen) === 'sofort'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Sofort fällig
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsbedingungen) === 'netto_7'}
            onClick={() => setFields(f => ({ ...f, zahlungsbedingungen: (lookupKey(f.zahlungsbedingungen) === 'netto_7' ? undefined : 'netto_7') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsbedingungen) === 'netto_7'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            7 Tage netto
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsbedingungen) === 'netto_14'}
            onClick={() => setFields(f => ({ ...f, zahlungsbedingungen: (lookupKey(f.zahlungsbedingungen) === 'netto_14' ? undefined : 'netto_14') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsbedingungen) === 'netto_14'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            14 Tage netto
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsbedingungen) === 'netto_30'}
            onClick={() => setFields(f => ({ ...f, zahlungsbedingungen: (lookupKey(f.zahlungsbedingungen) === 'netto_30' ? undefined : 'netto_30') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsbedingungen) === 'netto_30'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            30 Tage netto
          </button>
        </div>
      </div>
    ),
    'steuersatz': (
      <div key="steuersatz" className="space-y-1.5">
        <Label htmlFor="steuersatz">Steuersatz</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.steuersatz) === 'steuersatz_0'}
            onClick={() => setFields(f => ({ ...f, steuersatz: (lookupKey(f.steuersatz) === 'steuersatz_0' ? undefined : 'steuersatz_0') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.steuersatz) === 'steuersatz_0'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            0 %
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.steuersatz) === 'steuersatz_7'}
            onClick={() => setFields(f => ({ ...f, steuersatz: (lookupKey(f.steuersatz) === 'steuersatz_7' ? undefined : 'steuersatz_7') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.steuersatz) === 'steuersatz_7'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            7 %
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.steuersatz) === 'steuersatz_19'}
            onClick={() => setFields(f => ({ ...f, steuersatz: (lookupKey(f.steuersatz) === 'steuersatz_19' ? undefined : 'steuersatz_19') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.steuersatz) === 'steuersatz_19'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            19 %
          </button>
        </div>
      </div>
    ),
    'nettobetrag': (
      <div key="nettobetrag" className="space-y-1.5">
        <Label htmlFor="nettobetrag">Nettobetrag (€)</Label>
        <Input
          id="nettobetrag"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'nettobetrag')}
          placeholder="z. B. 5000,00"
          value={fields.nettobetrag !== undefined ? fields.nettobetrag : (computedValues['nettobetrag'] ?? '')}
          onChange={e => setFields(f => ({ ...f, nettobetrag: clampNumberValue(formEnhancements, 'nettobetrag', e.target.value) }))}
        />
      </div>
    ),
    'steuerbetrag': (
      <div key="steuerbetrag" className="space-y-1.5">
        <Label htmlFor="steuerbetrag">Steuerbetrag (€)</Label>
        <Input
          id="steuerbetrag"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'steuerbetrag')}
          placeholder="z. B. 950,00"
          value={fields.steuerbetrag !== undefined ? fields.steuerbetrag : (computedValues['steuerbetrag'] ?? '')}
          onChange={e => setFields(f => ({ ...f, steuerbetrag: clampNumberValue(formEnhancements, 'steuerbetrag', e.target.value) }))}
        />
      </div>
    ),
    'bruttobetrag': (
      <div key="bruttobetrag" className="space-y-1.5">
        <Label htmlFor="bruttobetrag">Bruttobetrag (€)</Label>
        <Input
          id="bruttobetrag"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'bruttobetrag')}
          placeholder="z. B. 5950,00"
          value={fields.bruttobetrag !== undefined ? fields.bruttobetrag : (computedValues['bruttobetrag'] ?? '')}
          onChange={e => setFields(f => ({ ...f, bruttobetrag: clampNumberValue(formEnhancements, 'bruttobetrag', e.target.value) }))}
        />
      </div>
    ),
    'waehrung': (
      <div key="waehrung" className="space-y-1.5">
        <Label htmlFor="waehrung">Währung</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.waehrung) === 'eur'}
            onClick={() => setFields(f => ({ ...f, waehrung: (lookupKey(f.waehrung) === 'eur' ? undefined : 'eur') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.waehrung) === 'eur'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            EUR
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.waehrung) === 'chf'}
            onClick={() => setFields(f => ({ ...f, waehrung: (lookupKey(f.waehrung) === 'chf' ? undefined : 'chf') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.waehrung) === 'chf'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            CHF
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.waehrung) === 'usd'}
            onClick={() => setFields(f => ({ ...f, waehrung: (lookupKey(f.waehrung) === 'usd' ? undefined : 'usd') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.waehrung) === 'usd'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            USD
          </button>
        </div>
      </div>
    ),
    'leistungszeitraum_von': (
      <div key="leistungszeitraum_von" className="space-y-1.5">
        <Label htmlFor="leistungszeitraum_von">Leistungszeitraum von</Label>
        <DatePicker
          id="leistungszeitraum_von"
          placeholder="Wann startet?"
          mode="date"
          value={fields.leistungszeitraum_von ?? null}
          onChange={v => setFields(f => ({ ...f, leistungszeitraum_von: v ?? undefined }))}
        />
      </div>
    ),
    'leistungszeitraum_bis': (
      <div key="leistungszeitraum_bis" className="space-y-1.5">
        <Label htmlFor="leistungszeitraum_bis">Leistungszeitraum bis</Label>
        <DatePicker
          id="leistungszeitraum_bis"
          placeholder="Wann endet?"
          mode="date"
          value={fields.leistungszeitraum_bis ?? null}
          onChange={v => setFields(f => ({ ...f, leistungszeitraum_bis: v ?? undefined }))}
        />
      </div>
    ),
    'bestellnummer': (
      <div key="bestellnummer" className="space-y-1.5">
        <Label htmlFor="bestellnummer">Bestellnummer / Referenz</Label>
        <Input
          id="bestellnummer"
          placeholder="z. B. PO-2026-0815"
          value={fields.bestellnummer ?? ''}
          onChange={e => setFields(f => ({ ...f, bestellnummer: e.target.value }))}
        />
      </div>
    ),
    'notizen': (
      <div key="notizen" className="space-y-1.5">
        <Label htmlFor="notizen">Bemerkungen / Notizen</Label>
        <Textarea
          id="notizen"
          placeholder="Besondere Bedingungen, Hinweise zur Zahlung..."
          value={fields.notizen ?? ''}
          onChange={e => setFields(f => ({ ...f, notizen: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'anhang': (
      <div key="anhang" className="space-y-1.5">
        <Label htmlFor="anhang">Anhang (z.B. Stundennachweis)</Label>
        {fields.anhang ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <IconFileText size={20} className="text-muted-foreground" />
              </div>
              <img
                src={fields.anhang}
                alt=""
                className="relative h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-foreground">{fields.anhang.split("/").pop()}</p>
              <div className="flex gap-2 mt-1">
                <label
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Ändern
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fileUrl = await uploadFile(file, file.name);
                        setFields(f => ({ ...f, anhang: fileUrl }));
                      } catch (err) { console.error('Upload failed:', err); }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setFields(f => ({ ...f, anhang: undefined }))}
                >
                  Entfernen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Datei hochladen</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const fileUrl = await uploadFile(file, file.name);
                  setFields(f => ({ ...f, anhang: fileUrl }));
                } catch (err) { console.error('Upload failed:', err); }
              }}
            />
          </label>
        )}
      </div>
    ),
    'rechnungsdatum': (
      <div key="rechnungsdatum" className="space-y-1.5">
        <Label htmlFor="rechnungsdatum">Rechnungsdatum <span className="text-destructive" aria-hidden="true">*</span></Label>
        <DatePicker
          id="rechnungsdatum"
          placeholder="Heute oder Ausstellungstag"
          mode="date"
          value={fields.rechnungsdatum ?? null}
          onChange={v => setFields(f => ({ ...f, rechnungsdatum: v ?? undefined }))}
          required
        />
        {showErrors && !fields.rechnungsdatum && (
          <p className="text-xs text-destructive mt-1">Pflichtfeld</p>
        )}
      </div>
    ),
    'faelligkeitsdatum': (
      <div key="faelligkeitsdatum" className="space-y-1.5">
        <Label htmlFor="faelligkeitsdatum">Fälligkeitsdatum</Label>
        <DatePicker
          id="faelligkeitsdatum"
          placeholder="Zahlungsfrist beachten"
          mode="date"
          value={fields.faelligkeitsdatum ?? null}
          onChange={v => setFields(f => ({ ...f, faelligkeitsdatum: v ?? undefined }))}
        />
      </div>
    ),
    'rechnungsstatus': (
      <div key="rechnungsstatus" className="space-y-1.5">
        <Label htmlFor="rechnungsstatus">Rechnungsstatus <span className="text-destructive" aria-hidden="true">*</span></Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.rechnungsstatus) === 'entwurf'}
            onClick={() => setFields(f => ({ ...f, rechnungsstatus: (lookupKey(f.rechnungsstatus) === 'entwurf' ? undefined : 'entwurf') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.rechnungsstatus) === 'entwurf'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Entwurf
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.rechnungsstatus) === 'versendet'}
            onClick={() => setFields(f => ({ ...f, rechnungsstatus: (lookupKey(f.rechnungsstatus) === 'versendet' ? undefined : 'versendet') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.rechnungsstatus) === 'versendet'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Versendet
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.rechnungsstatus) === 'bezahlt'}
            onClick={() => setFields(f => ({ ...f, rechnungsstatus: (lookupKey(f.rechnungsstatus) === 'bezahlt' ? undefined : 'bezahlt') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.rechnungsstatus) === 'bezahlt'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Bezahlt
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.rechnungsstatus) === 'ueberfaellig'}
            onClick={() => setFields(f => ({ ...f, rechnungsstatus: (lookupKey(f.rechnungsstatus) === 'ueberfaellig' ? undefined : 'ueberfaellig') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.rechnungsstatus) === 'ueberfaellig'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Überfällig
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.rechnungsstatus) === 'storniert'}
            onClick={() => setFields(f => ({ ...f, rechnungsstatus: (lookupKey(f.rechnungsstatus) === 'storniert' ? undefined : 'storniert') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.rechnungsstatus) === 'storniert'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Storniert
          </button>
        </div>
        {showErrors && !fields.rechnungsstatus && (
          <p className="text-xs text-destructive mt-1">Pflichtfeld</p>
        )}
      </div>
    ),
    'kunde': (
      <div key="kunde" className="space-y-1.5">
        <Label htmlFor="kunde">Kunde <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Combobox
          id="kunde"
          placeholder="Welcher Kunde?"
          items={kundenverwaltungListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.firmenname ?? r.record_id),
          }))}
          value={extractRecordId(fields.kunde)}
          onChange={id => setFields(f => ({ ...f, kunde: id ? createRecordUrl(APP_IDS.KUNDENVERWALTUNG, id) : undefined }))}
          searchPlaceholder="Suchen…"
          emptyText="Kein Treffer"
          onCreateNew={(q) => openCreateKundenverwaltung("kunde", q)}
          createLabel="Neu in Kundenverwaltung"
        />
        {showErrors && !fields.kunde && (
          <p className="text-xs text-destructive mt-1">Pflichtfeld</p>
        )}
      </div>
    ),
    'rechnungsnummer': (
      <div key="rechnungsnummer" className="space-y-1.5">
        <Label htmlFor="rechnungsnummer">Rechnungsnummer <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="rechnungsnummer"
          placeholder="z. B. RE-2026-001"
          value={fields.rechnungsnummer ?? ''}
          onChange={e => setFields(f => ({ ...f, rechnungsnummer: e.target.value }))}
          required
        />
        {showErrors && !fields.rechnungsnummer && (
          <p className="text-xs text-destructive mt-1">Pflichtfeld</p>
        )}
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"projekt": "Projekt", "zahlungsbedingungen": "Zahlungsbedingungen", "steuersatz": "Steuersatz", "nettobetrag": "Nettobetrag (€)", "steuerbetrag": "Steuerbetrag (€)", "bruttobetrag": "Bruttobetrag (€)", "waehrung": "Währung", "leistungszeitraum_von": "Leistungszeitraum von", "leistungszeitraum_bis": "Leistungszeitraum bis", "bestellnummer": "Bestellnummer / Referenz", "notizen": "Bemerkungen / Notizen", "anhang": "Anhang (z.B. Stundennachweis)", "rechnungsdatum": "Rechnungsdatum", "faelligkeitsdatum": "Fälligkeitsdatum", "rechnungsstatus": "Rechnungsstatus", "kunde": "Kunde", "rechnungsnummer": "Rechnungsnummer"};
  const CURRENCY_KEYS = new Set<string>(["nettobetrag", "steuerbetrag", "bruttobetrag"]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {"projekt": {"projektname": "Projektname", "projektnummer": "Projektnummer", "kunde": "Kunde", "projektbeschreibung": "Projektbeschreibung", "startdatum": "Startdatum", "enddatum": "Enddatum", "projektleiter_vorname": "Vorname Projektleiter", "projektleiter_nachname": "Nachname Projektleiter", "projektstatus": "Projektstatus", "budget": "Budget (€)", "notizen": "Notizen"}, "kunde": {"firmenname": "Firmenname", "ansprechpartner_vorname": "Vorname Ansprechpartner", "ansprechpartner_nachname": "Nachname Ansprechpartner", "email": "E-Mail-Adresse", "telefon": "Telefonnummer", "strasse": "Straße", "hausnummer": "Hausnummer", "plz": "Postleitzahl", "ort": "Ort", "land": "Land", "steuernummer": "Steuernummer / USt-IdNr.", "zahlungsbedingungen": "Zahlungsbedingungen", "iban": "IBAN", "notizen": "Interne Notizen"}};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 max-sm:[&>button]:size-10 max-sm:[&>button]:grid max-sm:[&>button]:place-items-center max-sm:[&>button]:rounded-full max-sm:[&>button]:border max-sm:[&>button]:border-input max-sm:[&>button]:bg-background max-sm:[&>button]:opacity-100 max-sm:[&>button>svg]:size-5">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-sm:py-2.5 max-sm:px-4 text-xs font-semibold transition-all mr-7 max-sm:mr-12 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">KI-Ausfüllen</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0 max-sm:[&_input]:h-11">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {showErrors && missingRequired.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                Bitte fülle die markierten Pflichtfelder aus.
              </p>
            )}
            {recordId && (
              <div className="pt-2 border-t border-border">
                <AttachmentsSection appId={APP_IDS.RECHNUNGSVERWALTUNG} recordId={recordId} />
              </div>
            )}
          </div>
          {submitError && (
            <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive" role="alert">
              <IconAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{submitError}</span>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2 max-sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} className="max-sm:h-12 max-sm:flex-1 max-sm:text-base">Abbrechen</Button>
            <Button
              type="submit"
              className="max-sm:h-12 max-sm:flex-1 max-sm:text-base"
              disabled={saving || !isDirty || (showErrors && missingRequired.length > 0)}
            >
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {createProjektverwaltungOpen && (
      <ProjektverwaltungDialog
        open={createProjektverwaltungOpen}
        onClose={() => setCreateProjektverwaltungOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createProjektverwaltungEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Projektverwaltung;
            setExtraProjektverwaltung(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.PROJEKTVERWALTUNG, result.id);
            setFields(prev => ({ ...prev, [createProjektverwaltungField]: url } as any));
          }
          setCreateProjektverwaltungOpen(false);
        }}
        defaultValues={createProjektverwaltungInitial
          ? ({ projektname: createProjektverwaltungInitial } as any)
          : undefined}
        kundenverwaltungList={kundenverwaltungList}
      />
    )}
    {createKundenverwaltungOpen && (
      <KundenverwaltungDialog
        open={createKundenverwaltungOpen}
        onClose={() => setCreateKundenverwaltungOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createKundenverwaltungEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Kundenverwaltung;
            setExtraKundenverwaltung(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.KUNDENVERWALTUNG, result.id);
            setFields(prev => ({ ...prev, [createKundenverwaltungField]: url } as any));
          }
          setCreateKundenverwaltungOpen(false);
        }}
        defaultValues={createKundenverwaltungInitial
          ? ({ firmenname: createKundenverwaltungInitial } as any)
          : undefined}
      />
    )}
    </>
  );
}