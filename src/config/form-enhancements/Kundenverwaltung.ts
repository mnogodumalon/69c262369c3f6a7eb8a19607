import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'firmenname',
    { row: ['ansprechpartner_vorname', 'ansprechpartner_nachname'], cols: '1fr 1fr' },
    'email',
    'telefon',
    { row: ['strasse', 'hausnummer'], cols: '2fr 1fr' },
    { row: ['plz', 'ort'], cols: '1fr 2fr' },
    'land',
    'steuernummer',
    'zahlungsbedingungen',
    'iban',
    'notizen',
  ],
  defaults: {
    'zahlungsbedingungen': { kind: 'lookup', key: 'netto_30', label: '30 Tage netto' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
