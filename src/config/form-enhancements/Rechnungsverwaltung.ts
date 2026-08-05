import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'rechnungsnummer',
    'kunde',
    'projekt',
    { row: ['rechnungsdatum', 'faelligkeitsdatum'], cols: '1fr 1fr' },
    { row: ['leistungszeitraum_von', 'leistungszeitraum_bis'], cols: '1fr 1fr' },
    'nettobetrag',
    'steuersatz',
    'steuerbetrag',
    'bruttobetrag',
    'waehrung',
    'zahlungsbedingungen',
    'rechnungsstatus',
    'bestellnummer',
    'notizen',
  ],
  defaults: {
    'rechnungsdatum': { kind: 'today' },
    'rechnungsstatus': { kind: 'lookup', key: 'entwurf', label: 'Entwurf' },
    'steuersatz': { kind: 'lookup', key: 'steuersatz_19', label: '19 %' },
    'waehrung': { kind: 'lookup', key: 'eur', label: 'EUR' },
    'zahlungsbedingungen': { kind: 'lookup', key: 'netto_30', label: '30 Tage netto' },
    'faelligkeitsdatum': { kind: 'todayOffset', days: 30 },
  },
  computed: {
    'steuerbetrag': (_fields, ctx) => {
      const netto = ctx.num('nettobetrag');
      const satzKey = ctx.lookupKey('steuersatz');
      const satz = satzKey === 'steuersatz_0' ? 0
                 : satzKey === 'steuersatz_7' ? 0.07
                 : satzKey === 'steuersatz_19' ? 0.19
                 : 0.19;
      return netto * satz;
    },
    'bruttobetrag': { op: 'add', left: { kind: 'field', key: 'nettobetrag' }, right: { kind: 'field', key: 'steuerbetrag' } },
  },
  numberFields: {
    'nettobetrag': {},
    'steuerbetrag': {},
    'bruttobetrag': {},
  },
};

export const computedDeps: Record<string, string[]> = {
  'steuerbetrag': ['nettobetrag', 'steuersatz'],
};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
