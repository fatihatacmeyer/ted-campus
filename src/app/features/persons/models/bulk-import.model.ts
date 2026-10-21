import { Person, PersonInsertRequest } from '../../../core/models/person.model';

export type ImportKind = 'student' | 'parent';

export type ImportField =
  | 'ad'
  | 'soyad'
  | 'sicilno'
  | 'personelno'
  | 'dogumtarih'
  | 'cinsiyet'
  | 'kangrubu'
  | 'cardid'
  | 'ceptelefon'
  | 'telefon1'
  | 'email'
  | 'adres'
  | 'il'
  | 'ilce'
  | 'firma'
  | 'direktorluk'
  | 'bolum'
  | 'altfirma'
  | 'giristarih'
  | 'ogrenciler';

export type ImportLookupKey =
  | 'firma'
  | 'direktorluk'
  | 'bolum'
  | 'altfirma'
  | 'cinsiyet'
  | 'kangrubu';

export interface LookupOption {
  id: number;
  ad: string;
  aliases?: string[];
}

export type ImportLookups = Record<ImportLookupKey, LookupOption[]>;

export interface RowIssue {
  key: string;
  params?: Record<string, string | number>;
}

export interface RawImportRow {
  rowNo: number;
  cells: Partial<Record<ImportField, unknown>>;
}

export type ImportRowStatus = 'ready' | 'update' | 'exists' | 'error';
export type ImportOutcomeStatus = 'imported' | 'partial' | 'failed';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ImportRow {
  rowNo: number;
  ad: string;
  soyad: string;
  key: string;
  payload: PersonInsertRequest | null;
  status: ImportRowStatus;
  issues: RowIssue[];
  existingId: number | null;
  relationStudentIds: number[];
  alreadyLinked: number;
  changes?: FieldChange[];
  outcome?: ImportOutcomeStatus;
  outcomeIssue?: RowIssue;
}

export interface ImportOutcome {
  rowNo: number;
  ok: boolean;
  id?: number;
  message?: string;
}

export type ImportEvent =
  | { type: 'record'; outcome: ImportOutcome }
  | { type: 'relationsStart'; total: number }
  | { type: 'relationAttempt' }
  | { type: 'relationResult'; rowNo: number; studentId: number; ok: boolean };

export interface ParsedSheet {
  rows: RawImportRow[];
  unknownHeaders: string[];
  missingRequired: string[];
}

export interface ValidationContext {
  lookups: ImportLookups;
  existingStudentsByTc: Map<string, Person[]>;
  studentIds: Set<number>;
  existingParentIdsByTc: Map<string, number>;
  relationKeys: Set<string>;
}

export interface ValidationOptions {
  updateExisting?: boolean;
}
