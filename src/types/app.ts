// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Rechnungsverwaltung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    projekt?: string; // applookup -> URL zu 'Projektverwaltung' Record
    zahlungsbedingungen?: LookupValue;
    steuersatz?: LookupValue;
    nettobetrag?: number;
    steuerbetrag?: number;
    bruttobetrag?: number;
    waehrung?: LookupValue;
    leistungszeitraum_von?: string; // Format: YYYY-MM-DD oder ISO String
    leistungszeitraum_bis?: string; // Format: YYYY-MM-DD oder ISO String
    bestellnummer?: string;
    notizen?: string;
    anhang?: string;
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    faelligkeitsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    rechnungsstatus?: LookupValue;
    kunde?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    rechnungsnummer?: string;
  };
}

export interface Rechnungspositionen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    rechnung?: string; // applookup -> URL zu 'Rechnungsverwaltung' Record
    positionsnummer?: number;
    leistung?: string; // applookup -> URL zu 'Leistungskatalog' Record
    positionsbeschreibung?: string;
    menge?: number;
    einheit?: LookupValue;
    einzelpreis?: number;
    rabatt_prozent?: number;
    gesamtpreis?: number;
    notizen?: string;
  };
}

export interface Projektverwaltung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    projektname?: string;
    projektnummer?: string;
    kunde?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    projektbeschreibung?: string;
    startdatum?: string; // Format: YYYY-MM-DD oder ISO String
    enddatum?: string; // Format: YYYY-MM-DD oder ISO String
    projektleiter_vorname?: string;
    projektleiter_nachname?: string;
    projektstatus?: LookupValue;
    budget?: number;
    notizen?: string;
  };
}

export interface Leistungskatalog {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    leistungsbezeichnung?: string;
    leistungsbeschreibung?: string;
    einheit?: LookupValue;
    standardpreis?: number;
    waehrung?: LookupValue;
    aktiv?: boolean;
  };
}

export interface Kundenverwaltung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    firmenname?: string;
    ansprechpartner_vorname?: string;
    ansprechpartner_nachname?: string;
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    land?: string;
    steuernummer?: string;
    zahlungsbedingungen?: LookupValue;
    iban?: string;
    notizen?: string;
  };
}

export const APP_IDS = {
  RECHNUNGSVERWALTUNG: '69c2620cac60f33e1cf25fbd',
  RECHNUNGSPOSITIONEN: '69c2620d460b73f5f7cfcb9e',
  PROJEKTVERWALTUNG: '69c2620ae4c34c170b7718d1',
  LEISTUNGSKATALOG: '69c262091b3fa68cae88452b',
  KUNDENVERWALTUNG: '69c261fd91d6b1af611078d2',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'rechnungsverwaltung': {
    zahlungsbedingungen: [{ key: "netto_60", label: "60 Tage netto" }, { key: "sofort", label: "Sofort fällig" }, { key: "netto_7", label: "7 Tage netto" }, { key: "netto_14", label: "14 Tage netto" }, { key: "netto_30", label: "30 Tage netto" }],
    steuersatz: [{ key: "steuersatz_0", label: "0 %" }, { key: "steuersatz_7", label: "7 %" }, { key: "steuersatz_19", label: "19 %" }],
    waehrung: [{ key: "eur", label: "EUR" }, { key: "chf", label: "CHF" }, { key: "usd", label: "USD" }],
    rechnungsstatus: [{ key: "entwurf", label: "Entwurf" }, { key: "versendet", label: "Versendet" }, { key: "bezahlt", label: "Bezahlt" }, { key: "ueberfaellig", label: "Überfällig" }, { key: "storniert", label: "Storniert" }],
  },
  'rechnungspositionen': {
    einheit: [{ key: "stunde", label: "Stunde" }, { key: "tag", label: "Tag" }, { key: "pauschal", label: "Pauschal" }, { key: "stueck", label: "Stück" }],
  },
  'projektverwaltung': {
    projektstatus: [{ key: "angebot", label: "Angebot" }, { key: "aktiv", label: "Aktiv" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "pausiert", label: "Pausiert" }, { key: "storniert", label: "Storniert" }],
  },
  'leistungskatalog': {
    einheit: [{ key: "stunde", label: "Stunde" }, { key: "tag", label: "Tag" }, { key: "pauschal", label: "Pauschal" }, { key: "stueck", label: "Stück" }],
    waehrung: [{ key: "eur", label: "EUR" }, { key: "chf", label: "CHF" }, { key: "usd", label: "USD" }],
  },
  'kundenverwaltung': {
    zahlungsbedingungen: [{ key: "netto_7", label: "7 Tage netto" }, { key: "netto_14", label: "14 Tage netto" }, { key: "netto_30", label: "30 Tage netto" }, { key: "netto_60", label: "60 Tage netto" }, { key: "sofort", label: "Sofort fällig" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'rechnungsverwaltung': {
    'projekt': 'applookup/select',
    'zahlungsbedingungen': 'lookup/select',
    'steuersatz': 'lookup/radio',
    'nettobetrag': 'number',
    'steuerbetrag': 'number',
    'bruttobetrag': 'number',
    'waehrung': 'lookup/radio',
    'leistungszeitraum_von': 'date/date',
    'leistungszeitraum_bis': 'date/date',
    'bestellnummer': 'string/text',
    'notizen': 'string/textarea',
    'anhang': 'file',
    'rechnungsdatum': 'date/date',
    'faelligkeitsdatum': 'date/date',
    'rechnungsstatus': 'lookup/select',
    'kunde': 'applookup/select',
    'rechnungsnummer': 'string/text',
  },
  'rechnungspositionen': {
    'rechnung': 'applookup/select',
    'positionsnummer': 'number',
    'leistung': 'applookup/select',
    'positionsbeschreibung': 'string/textarea',
    'menge': 'number',
    'einheit': 'lookup/radio',
    'einzelpreis': 'number',
    'rabatt_prozent': 'number',
    'gesamtpreis': 'number',
    'notizen': 'string/textarea',
  },
  'projektverwaltung': {
    'projektname': 'string/text',
    'projektnummer': 'string/text',
    'kunde': 'applookup/select',
    'projektbeschreibung': 'string/textarea',
    'startdatum': 'date/date',
    'enddatum': 'date/date',
    'projektleiter_vorname': 'string/text',
    'projektleiter_nachname': 'string/text',
    'projektstatus': 'lookup/select',
    'budget': 'number',
    'notizen': 'string/textarea',
  },
  'leistungskatalog': {
    'leistungsbezeichnung': 'string/text',
    'leistungsbeschreibung': 'string/textarea',
    'einheit': 'lookup/radio',
    'standardpreis': 'number',
    'waehrung': 'lookup/radio',
    'aktiv': 'bool',
  },
  'kundenverwaltung': {
    'firmenname': 'string/text',
    'ansprechpartner_vorname': 'string/text',
    'ansprechpartner_nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'land': 'string/text',
    'steuernummer': 'string/text',
    'zahlungsbedingungen': 'lookup/select',
    'iban': 'string/text',
    'notizen': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateRechnungsverwaltung = StripLookup<Rechnungsverwaltung['fields']>;
export type CreateRechnungspositionen = StripLookup<Rechnungspositionen['fields']>;
export type CreateProjektverwaltung = StripLookup<Projektverwaltung['fields']>;
export type CreateLeistungskatalog = StripLookup<Leistungskatalog['fields']>;
export type CreateKundenverwaltung = StripLookup<Kundenverwaltung['fields']>;