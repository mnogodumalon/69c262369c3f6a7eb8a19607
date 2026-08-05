import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Rechnungsverwaltung, Rechnungspositionen, Projektverwaltung, Leistungskatalog, Kundenverwaltung } from '@/types/app';
import { LivingAppsService, extractRecordId, cleanFieldsForApi } from '@/services/livingAppsService';
import { RechnungsverwaltungDialog } from '@/components/dialogs/RechnungsverwaltungDialog';
import { RechnungsverwaltungViewDialog } from '@/components/dialogs/RechnungsverwaltungViewDialog';
import { RechnungspositionenDialog } from '@/components/dialogs/RechnungspositionenDialog';
import { RechnungspositionenViewDialog } from '@/components/dialogs/RechnungspositionenViewDialog';
import { ProjektverwaltungDialog } from '@/components/dialogs/ProjektverwaltungDialog';
import { ProjektverwaltungViewDialog } from '@/components/dialogs/ProjektverwaltungViewDialog';
import { LeistungskatalogDialog } from '@/components/dialogs/LeistungskatalogDialog';
import { LeistungskatalogViewDialog } from '@/components/dialogs/LeistungskatalogViewDialog';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { KundenverwaltungViewDialog } from '@/components/dialogs/KundenverwaltungViewDialog';
import { BulkEditDialog } from '@/components/dialogs/BulkEditDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconPencil, IconTrash, IconPlus, IconFilter, IconX, IconArrowsUpDown, IconArrowUp, IconArrowDown, IconSearch, IconCopy, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

// Field metadata per entity for bulk edit and column filters
const RECHNUNGSVERWALTUNG_FIELDS = [
  { key: 'projekt', label: 'Projekt', type: 'applookup/select', targetEntity: 'projektverwaltung', targetAppId: 'PROJEKTVERWALTUNG', displayField: 'projektname' },
  { key: 'zahlungsbedingungen', label: 'Zahlungsbedingungen', type: 'lookup/select', options: [{ key: 'netto_60', label: '60 Tage netto' }, { key: 'sofort', label: 'Sofort fällig' }, { key: 'netto_7', label: '7 Tage netto' }, { key: 'netto_14', label: '14 Tage netto' }, { key: 'netto_30', label: '30 Tage netto' }] },
  { key: 'steuersatz', label: 'Steuersatz', type: 'lookup/radio', options: [{ key: 'steuersatz_0', label: '0 %' }, { key: 'steuersatz_7', label: '7 %' }, { key: 'steuersatz_19', label: '19 %' }] },
  { key: 'nettobetrag', label: 'Nettobetrag (€)', type: 'number' },
  { key: 'steuerbetrag', label: 'Steuerbetrag (€)', type: 'number' },
  { key: 'bruttobetrag', label: 'Bruttobetrag (€)', type: 'number' },
  { key: 'waehrung', label: 'Währung', type: 'lookup/radio', options: [{ key: 'eur', label: 'EUR' }, { key: 'chf', label: 'CHF' }, { key: 'usd', label: 'USD' }] },
  { key: 'leistungszeitraum_von', label: 'Leistungszeitraum von', type: 'date/date' },
  { key: 'leistungszeitraum_bis', label: 'Leistungszeitraum bis', type: 'date/date' },
  { key: 'bestellnummer', label: 'Bestellnummer / Referenz', type: 'string/text' },
  { key: 'notizen', label: 'Bemerkungen / Notizen', type: 'string/textarea' },
  { key: 'anhang', label: 'Anhang (z.B. Stundennachweis)', type: 'file' },
  { key: 'rechnungsdatum', label: 'Rechnungsdatum', type: 'date/date' },
  { key: 'faelligkeitsdatum', label: 'Fälligkeitsdatum', type: 'date/date' },
  { key: 'rechnungsstatus', label: 'Rechnungsstatus', type: 'lookup/select', options: [{ key: 'entwurf', label: 'Entwurf' }, { key: 'versendet', label: 'Versendet' }, { key: 'bezahlt', label: 'Bezahlt' }, { key: 'ueberfaellig', label: 'Überfällig' }, { key: 'storniert', label: 'Storniert' }] },
  { key: 'kunde', label: 'Kunde', type: 'applookup/select', targetEntity: 'kundenverwaltung', targetAppId: 'KUNDENVERWALTUNG', displayField: 'firmenname' },
  { key: 'rechnungsnummer', label: 'Rechnungsnummer', type: 'string/text' },
];
const RECHNUNGSPOSITIONEN_FIELDS = [
  { key: 'rechnung', label: 'Rechnung', type: 'applookup/select', targetEntity: 'rechnungsverwaltung', targetAppId: 'RECHNUNGSVERWALTUNG', displayField: 'rechnungsnummer' },
  { key: 'positionsnummer', label: 'Positionsnummer', type: 'number' },
  { key: 'leistung', label: 'Leistung aus Katalog', type: 'applookup/select', targetEntity: 'leistungskatalog', targetAppId: 'LEISTUNGSKATALOG', displayField: 'leistungsbezeichnung' },
  { key: 'positionsbeschreibung', label: 'Positionsbeschreibung', type: 'string/textarea' },
  { key: 'menge', label: 'Menge', type: 'number' },
  { key: 'einheit', label: 'Einheit', type: 'lookup/radio', options: [{ key: 'stunde', label: 'Stunde' }, { key: 'tag', label: 'Tag' }, { key: 'pauschal', label: 'Pauschal' }, { key: 'stueck', label: 'Stück' }] },
  { key: 'einzelpreis', label: 'Einzelpreis (€)', type: 'number' },
  { key: 'rabatt_prozent', label: 'Rabatt (%)', type: 'number' },
  { key: 'gesamtpreis', label: 'Gesamtpreis (€)', type: 'number' },
  { key: 'notizen', label: 'Anmerkungen zur Position', type: 'string/textarea' },
];
const PROJEKTVERWALTUNG_FIELDS = [
  { key: 'projektname', label: 'Projektname', type: 'string/text' },
  { key: 'projektnummer', label: 'Projektnummer', type: 'string/text' },
  { key: 'kunde', label: 'Kunde', type: 'applookup/select', targetEntity: 'kundenverwaltung', targetAppId: 'KUNDENVERWALTUNG', displayField: 'firmenname' },
  { key: 'projektbeschreibung', label: 'Projektbeschreibung', type: 'string/textarea' },
  { key: 'startdatum', label: 'Startdatum', type: 'date/date' },
  { key: 'enddatum', label: 'Enddatum', type: 'date/date' },
  { key: 'projektleiter_vorname', label: 'Vorname Projektleiter', type: 'string/text' },
  { key: 'projektleiter_nachname', label: 'Nachname Projektleiter', type: 'string/text' },
  { key: 'projektstatus', label: 'Projektstatus', type: 'lookup/select', options: [{ key: 'angebot', label: 'Angebot' }, { key: 'aktiv', label: 'Aktiv' }, { key: 'abgeschlossen', label: 'Abgeschlossen' }, { key: 'pausiert', label: 'Pausiert' }, { key: 'storniert', label: 'Storniert' }] },
  { key: 'budget', label: 'Budget (€)', type: 'number' },
  { key: 'notizen', label: 'Notizen', type: 'string/textarea' },
];
const LEISTUNGSKATALOG_FIELDS = [
  { key: 'leistungsbezeichnung', label: 'Leistungsbezeichnung', type: 'string/text' },
  { key: 'leistungsbeschreibung', label: 'Beschreibung', type: 'string/textarea' },
  { key: 'einheit', label: 'Einheit', type: 'lookup/radio', options: [{ key: 'stunde', label: 'Stunde' }, { key: 'tag', label: 'Tag' }, { key: 'pauschal', label: 'Pauschal' }, { key: 'stueck', label: 'Stück' }] },
  { key: 'standardpreis', label: 'Standardpreis (€)', type: 'number' },
  { key: 'waehrung', label: 'Währung', type: 'lookup/radio', options: [{ key: 'eur', label: 'EUR' }, { key: 'chf', label: 'CHF' }, { key: 'usd', label: 'USD' }] },
  { key: 'aktiv', label: 'Leistung aktiv', type: 'bool' },
];
const KUNDENVERWALTUNG_FIELDS = [
  { key: 'firmenname', label: 'Firmenname', type: 'string/text' },
  { key: 'ansprechpartner_vorname', label: 'Vorname Ansprechpartner', type: 'string/text' },
  { key: 'ansprechpartner_nachname', label: 'Nachname Ansprechpartner', type: 'string/text' },
  { key: 'email', label: 'E-Mail-Adresse', type: 'string/email' },
  { key: 'telefon', label: 'Telefonnummer', type: 'string/tel' },
  { key: 'strasse', label: 'Straße', type: 'string/text' },
  { key: 'hausnummer', label: 'Hausnummer', type: 'string/text' },
  { key: 'plz', label: 'Postleitzahl', type: 'string/text' },
  { key: 'ort', label: 'Ort', type: 'string/text' },
  { key: 'land', label: 'Land', type: 'string/text' },
  { key: 'steuernummer', label: 'Steuernummer / USt-IdNr.', type: 'string/text' },
  { key: 'zahlungsbedingungen', label: 'Zahlungsbedingungen', type: 'lookup/select', options: [{ key: 'netto_7', label: '7 Tage netto' }, { key: 'netto_14', label: '14 Tage netto' }, { key: 'netto_30', label: '30 Tage netto' }, { key: 'netto_60', label: '60 Tage netto' }, { key: 'sofort', label: 'Sofort fällig' }] },
  { key: 'iban', label: 'IBAN', type: 'string/text' },
  { key: 'notizen', label: 'Interne Notizen', type: 'string/textarea' },
];

const ENTITY_TABS = [
  { key: 'rechnungsverwaltung', label: 'Rechnungsverwaltung', pascal: 'Rechnungsverwaltung' },
  { key: 'rechnungspositionen', label: 'Rechnungspositionen', pascal: 'Rechnungspositionen' },
  { key: 'projektverwaltung', label: 'Projektverwaltung', pascal: 'Projektverwaltung' },
  { key: 'leistungskatalog', label: 'Leistungskatalog', pascal: 'Leistungskatalog' },
  { key: 'kundenverwaltung', label: 'Kundenverwaltung', pascal: 'Kundenverwaltung' },
] as const;

type EntityKey = typeof ENTITY_TABS[number]['key'];

export default function AdminPage() {
  const data = useDashboardData();
  const { loading, error, fetchAll } = data;

  const [activeTab, setActiveTab] = useState<EntityKey>('rechnungsverwaltung');
  const [selectedIds, setSelectedIds] = useState<Record<EntityKey, Set<string>>>(() => ({
    'rechnungsverwaltung': new Set(),
    'rechnungspositionen': new Set(),
    'projektverwaltung': new Set(),
    'leistungskatalog': new Set(),
    'kundenverwaltung': new Set(),
  }));
  const [filters, setFilters] = useState<Record<EntityKey, Record<string, string>>>(() => ({
    'rechnungsverwaltung': {},
    'rechnungspositionen': {},
    'projektverwaltung': {},
    'leistungskatalog': {},
    'kundenverwaltung': {},
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [dialogState, setDialogState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [createEntity, setCreateEntity] = useState<EntityKey | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<{ entity: EntityKey; ids: string[] } | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState<EntityKey | null>(null);
  const [viewState, setViewState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const getRecords = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'rechnungsverwaltung': return (data as any).rechnungsverwaltung as Rechnungsverwaltung[] ?? [];
      case 'rechnungspositionen': return (data as any).rechnungspositionen as Rechnungspositionen[] ?? [];
      case 'projektverwaltung': return (data as any).projektverwaltung as Projektverwaltung[] ?? [];
      case 'leistungskatalog': return (data as any).leistungskatalog as Leistungskatalog[] ?? [];
      case 'kundenverwaltung': return (data as any).kundenverwaltung as Kundenverwaltung[] ?? [];
      default: return [];
    }
  }, [data]);

  const getLookupLists = useCallback((entity: EntityKey) => {
    const lists: Record<string, any[]> = {};
    switch (entity) {
      case 'rechnungsverwaltung':
        lists.projektverwaltungList = (data as any).projektverwaltung ?? [];
        lists.kundenverwaltungList = (data as any).kundenverwaltung ?? [];
        break;
      case 'rechnungspositionen':
        lists.rechnungsverwaltungList = (data as any).rechnungsverwaltung ?? [];
        lists.leistungskatalogList = (data as any).leistungskatalog ?? [];
        break;
      case 'projektverwaltung':
        lists.kundenverwaltungList = (data as any).kundenverwaltung ?? [];
        break;
    }
    return lists;
  }, [data]);

  const getApplookupDisplay = useCallback((entity: EntityKey, fieldKey: string, url?: unknown) => {
    if (!url) return '—';
    const id = extractRecordId(url);
    if (!id) return '—';
    const lists = getLookupLists(entity);
    void fieldKey; // ensure used for noUnusedParameters
    if (entity === 'rechnungsverwaltung' && fieldKey === 'projekt') {
      const match = (lists.projektverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.projektname ?? '—';
    }
    if (entity === 'rechnungsverwaltung' && fieldKey === 'kunde') {
      const match = (lists.kundenverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.firmenname ?? '—';
    }
    if (entity === 'rechnungspositionen' && fieldKey === 'rechnung') {
      const match = (lists.rechnungsverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.rechnungsnummer ?? '—';
    }
    if (entity === 'rechnungspositionen' && fieldKey === 'leistung') {
      const match = (lists.leistungskatalogList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.leistungsbezeichnung ?? '—';
    }
    if (entity === 'projektverwaltung' && fieldKey === 'kunde') {
      const match = (lists.kundenverwaltungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.firmenname ?? '—';
    }
    return String(url);
  }, [getLookupLists]);

  const getFieldMeta = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'rechnungsverwaltung': return RECHNUNGSVERWALTUNG_FIELDS;
      case 'rechnungspositionen': return RECHNUNGSPOSITIONEN_FIELDS;
      case 'projektverwaltung': return PROJEKTVERWALTUNG_FIELDS;
      case 'leistungskatalog': return LEISTUNGSKATALOG_FIELDS;
      case 'kundenverwaltung': return KUNDENVERWALTUNG_FIELDS;
      default: return [];
    }
  }, []);

  const getFilteredRecords = useCallback((entity: EntityKey) => {
    const records = getRecords(entity);
    const s = search.toLowerCase();
    const searched = !s ? records : records.filter((r: any) => {
      return Object.values(r.fields).some((v: any) => {
        if (v == null) return false;
        if (Array.isArray(v)) return v.some((item: any) => typeof item === 'object' && item !== null && 'label' in item ? String((item as any).label).toLowerCase().includes(s) : String(item).toLowerCase().includes(s));
        if (typeof v === 'object' && 'label' in (v as any)) return String((v as any).label).toLowerCase().includes(s);
        return String(v).toLowerCase().includes(s);
      });
    });
    const entityFilters = filters[entity] ?? {};
    const fieldMeta = getFieldMeta(entity);
    return searched.filter((r: any) => {
      return fieldMeta.every((fm: any) => {
        const fv = entityFilters[fm.key];
        if (!fv || fv === '') return true;
        const val = r.fields?.[fm.key];
        if (fm.type === 'bool') {
          if (fv === 'true') return val === true;
          if (fv === 'false') return val !== true;
          return true;
        }
        if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
          const label = val && typeof val === 'object' && 'label' in val ? val.label : '';
          return String(label).toLowerCase().includes(fv.toLowerCase());
        }
        if (fm.type.includes('multiplelookup')) {
          if (!Array.isArray(val)) return false;
          return val.some((item: any) => String(item?.label ?? '').toLowerCase().includes(fv.toLowerCase()));
        }
        if (fm.type.includes('applookup')) {
          const display = getApplookupDisplay(entity, fm.key, val);
          return String(display).toLowerCase().includes(fv.toLowerCase());
        }
        return String(val ?? '').toLowerCase().includes(fv.toLowerCase());
      });
    });
  }, [getRecords, filters, getFieldMeta, getApplookupDisplay, search]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(''); setSortDir('asc'); }
    } else { setSortKey(key); setSortDir('asc'); }
  }

  function sortRecords<T extends { fields: Record<string, any> }>(recs: T[]): T[] {
    if (!sortKey) return recs;
    return [...recs].sort((a, b) => {
      let va: any = a.fields[sortKey], vb: any = b.fields[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'object' && 'label' in va) va = va.label;
      if (typeof vb === 'object' && 'label' in vb) vb = vb.label;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  const toggleSelect = useCallback((entity: EntityKey, id: string) => {
    setSelectedIds(prev => {
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (next[entity].has(id)) next[entity].delete(id);
      else next[entity].add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((entity: EntityKey) => {
    const filtered = getFilteredRecords(entity);
    setSelectedIds(prev => {
      const allSelected = filtered.every((r: any) => prev[entity].has(r.record_id));
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (allSelected) {
        filtered.forEach((r: any) => next[entity].delete(r.record_id));
      } else {
        filtered.forEach((r: any) => next[entity].add(r.record_id));
      }
      return next;
    });
  }, [getFilteredRecords]);

  const clearSelection = useCallback((entity: EntityKey) => {
    setSelectedIds(prev => ({ ...prev, [entity]: new Set() }));
  }, []);

  const getServiceMethods = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'rechnungsverwaltung': return {
        create: (fields: any) => LivingAppsService.createRechnungsverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateRechnungsverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteRechnungsverwaltungEntry(id),
      };
      case 'rechnungspositionen': return {
        create: (fields: any) => LivingAppsService.createRechnungspositionenEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateRechnungspositionenEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteRechnungspositionenEntry(id),
      };
      case 'projektverwaltung': return {
        create: (fields: any) => LivingAppsService.createProjektverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateProjektverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteProjektverwaltungEntry(id),
      };
      case 'leistungskatalog': return {
        create: (fields: any) => LivingAppsService.createLeistungskatalogEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateLeistungskatalogEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteLeistungskatalogEntry(id),
      };
      case 'kundenverwaltung': return {
        create: (fields: any) => LivingAppsService.createKundenverwaltungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateKundenverwaltungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteKundenverwaltungEntry(id),
      };
      default: return null;
    }
  }, []);

  async function handleCreate(entity: EntityKey, fields: any) {
    const svc = getServiceMethods(entity);
    if (!svc) return;
    await svc.create(fields);
    fetchAll();
    setCreateEntity(null);
  }

  async function handleUpdate(fields: any) {
    if (!dialogState) return;
    const svc = getServiceMethods(dialogState.entity);
    if (!svc) return;
    await svc.update(dialogState.record.record_id, fields);
    fetchAll();
    setDialogState(null);
  }

  async function handleBulkDelete() {
    if (!deleteTargets) return;
    const svc = getServiceMethods(deleteTargets.entity);
    if (!svc) return;
    setBulkLoading(true);
    try {
      for (const id of deleteTargets.ids) {
        await svc.remove(id);
      }
      clearSelection(deleteTargets.entity);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setDeleteTargets(null);
    }
  }

  async function handleBulkClone() {
    const svc = getServiceMethods(activeTab);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const records = getRecords(activeTab);
      const ids = Array.from(selectedIds[activeTab]);
      for (const id of ids) {
        const rec = records.find((r: any) => r.record_id === id);
        if (!rec) continue;
        const clean = cleanFieldsForApi(rec.fields, activeTab);
        await svc.create(clean as any);
      }
      clearSelection(activeTab);
      fetchAll();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkEdit(fieldKey: string, value: any) {
    if (!bulkEditOpen) return;
    const svc = getServiceMethods(bulkEditOpen);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds[bulkEditOpen]);
      for (const id of ids) {
        await svc.update(id, { [fieldKey]: value });
      }
      clearSelection(bulkEditOpen);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setBulkEditOpen(null);
    }
  }

  function updateFilter(entity: EntityKey, fieldKey: string, value: string) {
    setFilters(prev => ({
      ...prev,
      [entity]: { ...prev[entity], [fieldKey]: value },
    }));
  }

  function clearEntityFilters(entity: EntityKey) {
    setFilters(prev => ({ ...prev, [entity]: {} }));
  }

  const activeFilterCount = useMemo(() => {
    const f = filters[activeTab] ?? {};
    return Object.values(f).filter(v => v && v !== '').length;
  }, [filters, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive">{error.message}</p>
        <Button onClick={fetchAll}>Erneut versuchen</Button>
      </div>
    );
  }

  const filtered = getFilteredRecords(activeTab);
  const sel = selectedIds[activeTab];
  const allFiltered = filtered.every((r: any) => sel.has(r.record_id)) && filtered.length > 0;
  const fieldMeta = getFieldMeta(activeTab);

  return (
    <PageShell
      title="Verwaltung"
      subtitle="Alle Daten verwalten"
      action={
        <Button onClick={() => setCreateEntity(activeTab)} className="shrink-0">
          <IconPlus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      }
    >
      <div className="flex gap-2 flex-wrap">
        {ENTITY_TABS.map(tab => {
          const count = getRecords(tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); setSortKey(''); setSortDir('asc'); fetchAll(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="gap-2">
            <IconFilter className="h-4 w-4" />
            Filtern
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearEntityFilters(activeTab)}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
        {sel.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-muted/60 rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium">{sel.size} ausgewählt</span>
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(activeTab)}>
              <IconPencil className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Feld bearbeiten</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkClone()}>
              <IconCopy className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Kopieren</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteTargets({ entity: activeTab, ids: Array.from(sel) })}>
              <IconTrash className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Ausgewählte löschen</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => clearSelection(activeTab)}>
              <IconX className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Auswahl aufheben</span>
            </Button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/30">
          {fieldMeta.map((fm: any) => (
            <div key={fm.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{fm.label}</label>
              {fm.type === 'bool' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="true">Ja</SelectItem>
                    <SelectItem value="false">Nein</SelectItem>
                  </SelectContent>
                </Select>
              ) : fm.type === 'lookup/select' || fm.type === 'lookup/radio' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {fm.options?.map((o: any) => (
                      <SelectItem key={o.key} value={o.label}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  placeholder="Filtern..."
                  value={filters[activeTab]?.[fm.key] ?? ''}
                  onChange={e => updateFilter(activeTab, fm.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[27px] bg-card shadow-lg overflow-x-auto">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="w-10 px-6">
                <Checkbox
                  checked={allFiltered}
                  onCheckedChange={() => toggleSelectAll(activeTab)}
                />
              </TableHead>
              {fieldMeta.map((fm: any) => (
                <TableHead key={fm.key} className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(fm.key)}>
                  <span className="inline-flex items-center gap-1">
                    {fm.label}
                    {sortKey === fm.key ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map((record: any) => (
              <TableRow key={record.record_id} className={`transition-colors cursor-pointer ${sel.has(record.record_id) ? "bg-primary/5" : "hover:bg-muted/50"}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewState({ entity: activeTab, record }); }}>
                <TableCell>
                  <Checkbox
                    checked={sel.has(record.record_id)}
                    onCheckedChange={() => toggleSelect(activeTab, record.record_id)}
                  />
                </TableCell>
                {fieldMeta.map((fm: any) => {
                  const val = record.fields?.[fm.key];
                  if (fm.type === 'bool') {
                    return (
                      <TableCell key={fm.key}>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          val ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {val ? 'Ja' : 'Nein'}
                        </span>
                      </TableCell>
                    );
                  }
                  if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{val?.label ?? '—'}</span></TableCell>;
                  }
                  if (fm.type.startsWith('multiplelookup')) {
                    return <TableCell key={fm.key}>{Array.isArray(val) ? val.map((v: any) => v?.label ?? v).join(', ') : '—'}</TableCell>;
                  }
                  if (fm.type.startsWith('multipleapplookup')) {
                    return (
                      <TableCell key={fm.key}>
                        {Array.isArray(val) && val.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {val.map((url: any, i: number) => (
                              <span key={i} className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, url)}</span>
                            ))}
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type.startsWith('applookup')) {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, val)}</span></TableCell>;
                  }
                  if (fm.type.includes('date')) {
                    return <TableCell key={fm.key} className="text-muted-foreground">{fmtDate(val)}</TableCell>;
                  }
                  if (fm.type.startsWith('file')) {
                    return (
                      <TableCell key={fm.key}>
                        {val ? (
                          <div className="relative h-8 w-8 rounded bg-muted overflow-hidden">
                            <img src={val} alt="" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type === 'string/textarea') {
                    return <TableCell key={fm.key} className="max-w-xs"><span className="truncate block">{val ?? '—'}</span></TableCell>;
                  }
                  if (fm.type === 'geo') {
                    return (
                      <TableCell key={fm.key} className="max-w-[200px]">
                        <span className="truncate block" title={val ? `${val.lat}, ${val.long}` : undefined}>
                          {val?.info ?? (val ? `${val.lat?.toFixed(4)}, ${val.long?.toFixed(4)}` : '—')}
                        </span>
                      </TableCell>
                    );
                  }
                  return <TableCell key={fm.key}>{val ?? '—'}</TableCell>;
                })}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDialogState({ entity: activeTab, record })}>
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTargets({ entity: activeTab, ids: [record.record_id] })}>
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={fieldMeta.length + 2} className="text-center py-16 text-muted-foreground">
                  Keine Ergebnisse gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(createEntity === 'rechnungsverwaltung' || dialogState?.entity === 'rechnungsverwaltung') && (
        <RechnungsverwaltungDialog
          open={createEntity === 'rechnungsverwaltung' || dialogState?.entity === 'rechnungsverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'rechnungsverwaltung' ? handleUpdate : (fields: any) => handleCreate('rechnungsverwaltung', fields)}
          defaultValues={dialogState?.entity === 'rechnungsverwaltung' ? dialogState.record?.fields : undefined}
          projektverwaltungList={(data as any).projektverwaltung ?? []}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Rechnungsverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Rechnungsverwaltung']}
        />
      )}
      {(createEntity === 'rechnungspositionen' || dialogState?.entity === 'rechnungspositionen') && (
        <RechnungspositionenDialog
          open={createEntity === 'rechnungspositionen' || dialogState?.entity === 'rechnungspositionen'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'rechnungspositionen' ? handleUpdate : (fields: any) => handleCreate('rechnungspositionen', fields)}
          defaultValues={dialogState?.entity === 'rechnungspositionen' ? dialogState.record?.fields : undefined}
          rechnungsverwaltungList={(data as any).rechnungsverwaltung ?? []}
          leistungskatalogList={(data as any).leistungskatalog ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Rechnungspositionen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Rechnungspositionen']}
        />
      )}
      {(createEntity === 'projektverwaltung' || dialogState?.entity === 'projektverwaltung') && (
        <ProjektverwaltungDialog
          open={createEntity === 'projektverwaltung' || dialogState?.entity === 'projektverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'projektverwaltung' ? handleUpdate : (fields: any) => handleCreate('projektverwaltung', fields)}
          defaultValues={dialogState?.entity === 'projektverwaltung' ? dialogState.record?.fields : undefined}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Projektverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Projektverwaltung']}
        />
      )}
      {(createEntity === 'leistungskatalog' || dialogState?.entity === 'leistungskatalog') && (
        <LeistungskatalogDialog
          open={createEntity === 'leistungskatalog' || dialogState?.entity === 'leistungskatalog'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'leistungskatalog' ? handleUpdate : (fields: any) => handleCreate('leistungskatalog', fields)}
          defaultValues={dialogState?.entity === 'leistungskatalog' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Leistungskatalog']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Leistungskatalog']}
        />
      )}
      {(createEntity === 'kundenverwaltung' || dialogState?.entity === 'kundenverwaltung') && (
        <KundenverwaltungDialog
          open={createEntity === 'kundenverwaltung' || dialogState?.entity === 'kundenverwaltung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'kundenverwaltung' ? handleUpdate : (fields: any) => handleCreate('kundenverwaltung', fields)}
          defaultValues={dialogState?.entity === 'kundenverwaltung' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Kundenverwaltung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Kundenverwaltung']}
        />
      )}
      {viewState?.entity === 'rechnungsverwaltung' && (
        <RechnungsverwaltungViewDialog
          open={viewState?.entity === 'rechnungsverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'rechnungsverwaltung', record: r }); }}
          projektverwaltungList={(data as any).projektverwaltung ?? []}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
        />
      )}
      {viewState?.entity === 'rechnungspositionen' && (
        <RechnungspositionenViewDialog
          open={viewState?.entity === 'rechnungspositionen'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'rechnungspositionen', record: r }); }}
          rechnungsverwaltungList={(data as any).rechnungsverwaltung ?? []}
          leistungskatalogList={(data as any).leistungskatalog ?? []}
        />
      )}
      {viewState?.entity === 'projektverwaltung' && (
        <ProjektverwaltungViewDialog
          open={viewState?.entity === 'projektverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'projektverwaltung', record: r }); }}
          kundenverwaltungList={(data as any).kundenverwaltung ?? []}
        />
      )}
      {viewState?.entity === 'leistungskatalog' && (
        <LeistungskatalogViewDialog
          open={viewState?.entity === 'leistungskatalog'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'leistungskatalog', record: r }); }}
        />
      )}
      {viewState?.entity === 'kundenverwaltung' && (
        <KundenverwaltungViewDialog
          open={viewState?.entity === 'kundenverwaltung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'kundenverwaltung', record: r }); }}
        />
      )}

      <BulkEditDialog
        open={!!bulkEditOpen}
        onClose={() => setBulkEditOpen(null)}
        onApply={handleBulkEdit}
        fields={bulkEditOpen ? getFieldMeta(bulkEditOpen) : []}
        selectedCount={bulkEditOpen ? selectedIds[bulkEditOpen].size : 0}
        loading={bulkLoading}
        lookupLists={bulkEditOpen ? getLookupLists(bulkEditOpen) : {}}
      />

      <ConfirmDialog
        open={!!deleteTargets}
        onClose={() => setDeleteTargets(null)}
        onConfirm={handleBulkDelete}
        title="Ausgewählte löschen"
        description={`Sollen ${deleteTargets?.ids.length ?? 0} Einträge wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
      />
    </PageShell>
  );
}