import type { Projektverwaltung, Rechnungspositionen, Rechnungsverwaltung } from './app';

export type EnrichedRechnungsverwaltung = Rechnungsverwaltung & {
  projektName: string;
  kundeName: string;
};

export type EnrichedRechnungspositionen = Rechnungspositionen & {
  rechnungName: string;
  leistungName: string;
};

export type EnrichedProjektverwaltung = Projektverwaltung & {
  kundeName: string;
};
