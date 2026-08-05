import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'rechnung',
    'positionsnummer',
    'leistung',
    'positionsbeschreibung',
    'einheit',
    'menge',
    'einzelpreis',
    'rabatt_prozent',
    'gesamtpreis',
    'notizen',
  ],
  defaults: {
    'positionsnummer': { kind: 'literal', value: 1 },
    'menge': { kind: 'literal', value: 1 },
    'rabatt_prozent': { kind: 'literal', value: 0 },
  },
  computed: {
    'einzelpreis': (_fields, ctx) => {
      const vomLeistung = ctx.applookup('leistung', 'standardpreis');
      return vomLeistung ?? null;
    },
    'gesamtpreis': { op: 'mul', left: { op: 'mul', left: { kind: 'field', key: 'menge' }, right: { kind: 'field', key: 'einzelpreis' } }, right: { op: 'sub', left: { kind: 'literal', value: 1 }, right: { op: 'div', left: { kind: 'field', key: 'rabatt_prozent' }, right: { kind: 'literal', value: 100 } } } },
  },
  numberFields: {
    'positionsnummer': {},
    'menge': {},
    'einzelpreis': {},
    'rabatt_prozent': { max: 100 },
    'gesamtpreis': {},
  },
};

export const computedDeps: Record<string, string[]> = {
  'einzelpreis': ['leistung'],
};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {
  'leistung': [{ lookupKey: 'standardpreis' }],
};
