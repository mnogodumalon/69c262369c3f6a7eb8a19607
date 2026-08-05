import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'projektname',
    'projektnummer',
    'kunde',
    'projektbeschreibung',
    { row: ['startdatum', 'enddatum'], cols: '1fr 1fr' },
    { row: ['projektleiter_vorname', 'projektleiter_nachname'], cols: '1fr 1fr' },
    'projektstatus',
    'budget',
    'notizen',
  ],
  defaults: {
    'projektstatus': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
  },
  computed: {},
  numberFields: {
    'budget': {},
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
