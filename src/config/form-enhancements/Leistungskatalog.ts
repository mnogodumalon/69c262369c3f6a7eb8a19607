import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'leistungsbezeichnung',
    'einheit',
    'standardpreis',
    'waehrung',
    'leistungsbeschreibung',
    'aktiv',
  ],
  defaults: {
    'einheit': { kind: 'lookup', key: 'stunde', label: 'Stunde' },
    'waehrung': { kind: 'lookup', key: 'eur', label: 'EUR' },
    'aktiv': { kind: 'literal', value: true },
  },
  computed: {},
  numberFields: {
    'standardpreis': {},
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
