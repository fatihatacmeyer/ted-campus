import { Person, PersonInsertRequest, RelationCampusRow, UserDef } from '../../../core/models/person.model';
import {
  ImportField,
  ImportKind,
  ImportLookupKey,
  ImportLookups,
  ImportRow,
  LookupOption,
  ParsedSheet,
  RawImportRow,
  RowIssue,
  ValidationContext,
} from '../models/bulk-import.model';

/** Tek dosyada kabul edilen en fazla veri satırı. */
export const MAX_IMPORT_ROWS = 2000;

type ColumnKind = 'text' | 'date' | 'phone' | 'email' | 'tc' | 'lookup' | 'students';

export interface ImportColumn {
  field: ImportField;
  /** Şablondaki Excel başlığı (uygulamadaki form etiketleriyle aynı). */
  header: string;
  required?: boolean;
  kind: ColumnKind;
  lookup?: ImportLookupKey;
  /** Başlık eşleştirmesinde kabul edilen ek yazımlar. */
  aliases?: string[];
  description: string;
  example: string;
}

// ─── Sütun tanımları (şablonun tek kaynağı) ───

const LIST_HINT = "'Listeler' sayfasındaki değerlerden biri";

/** Öğrenci ve veli şablonlarında ortak olan sütunlar. */
const COMMON: Record<string, ImportColumn> = {
  ad: { field: 'ad', header: 'Ad', required: true, kind: 'text', description: 'Adı', example: 'Ayşe' },
  soyad: { field: 'soyad', header: 'Soyad', required: true, kind: 'text', description: 'Soyadı', example: 'Yılmaz' },
  personelno: {
    field: 'personelno',
    header: 'TC Kimlik No',
    kind: 'tc',
    aliases: ['tc', 'personelno'],
    description: '11 haneli olmalıdır (isteğe bağlı)',
    example: '12345678901',
  },
  dogumtarih: {
    field: 'dogumtarih',
    header: 'Doğum Tarihi',
    kind: 'date',
    aliases: ['dogumtarihi'],
    description: 'GG.AA.YYYY veya Excel tarih hücresi',
    example: '15.03.1985',
  },
  cinsiyet: { field: 'cinsiyet', header: 'Cinsiyet', kind: 'lookup', lookup: 'cinsiyet', description: LIST_HINT, example: 'Kadın' },
  kangrubu: { field: 'kangrubu', header: 'Kan Grubu', kind: 'lookup', lookup: 'kangrubu', description: LIST_HINT, example: 'A Rh+' },
  cardid: { field: 'cardid', header: 'Kart ID', kind: 'text', aliases: ['kartno'], description: 'Kart numarası', example: '0012345678' },
  ceptelefon: {
    field: 'ceptelefon',
    header: 'Cep Telefonu',
    kind: 'phone',
    aliases: ['ceptelefonu'],
    description: '10 haneli (5XXXXXXXXX); başındaki 0 veya +90 yazılabilir',
    example: '5551234567',
  },
  telefon1: { field: 'telefon1', header: 'Telefon 1', kind: 'text', description: 'Ek telefon', example: '' },
  email: { field: 'email', header: 'E-posta', kind: 'email', aliases: ['email'], description: 'Geçerli e-posta adresi', example: 'ayse@ornek.com' },
  adres: { field: 'adres', header: 'Adres', kind: 'text', description: "'&' ve '=' karakterleri kullanılamaz", example: 'Atatürk Mah. 12. Sk. No:3' },
  il: { field: 'il', header: 'İl', kind: 'text', description: 'İl adı', example: 'İstanbul' },
  ilce: { field: 'ilce', header: 'İlçe', kind: 'text', description: 'İlçe adı', example: 'Kadıköy' },
  firma: {
    field: 'firma',
    header: 'Kampüs',
    kind: 'lookup',
    lookup: 'firma',
    aliases: ['firma'],
    description: LIST_HINT,
    example: 'Merkez Kampüs',
  },
  giristarih: {
    field: 'giristarih',
    header: 'Giriş Tarihi',
    kind: 'date',
    aliases: ['giristarihi'],
    description: 'GG.AA.YYYY veya Excel tarih hücresi',
    example: '09.09.2024',
  },
};

const STUDENT_COLUMNS: ImportColumn[] = [
  { ...COMMON['ad'], description: 'Öğrencinin adı' },
  { ...COMMON['soyad'], description: 'Öğrencinin soyadı' },
  {
    field: 'sicilno',
    header: 'Okul No',
    kind: 'text',
    aliases: ['sicilno'],
    description: 'Boş bırakılırsa sistem otomatik numara üretir. Sistemde kayıtlıysa satır atlanır.',
    example: '1001',
  },
  COMMON['personelno'],
  { ...COMMON['dogumtarih'], example: '15.03.2012' },
  COMMON['cinsiyet'],
  COMMON['kangrubu'],
  COMMON['cardid'],
  COMMON['ceptelefon'],
  COMMON['telefon1'],
  COMMON['email'],
  COMMON['adres'],
  COMMON['il'],
  COMMON['ilce'],
  COMMON['firma'],
  { field: 'direktorluk', header: 'Eğitim Düzeyi', kind: 'lookup', lookup: 'direktorluk', aliases: ['direktorluk', 'kademe'], description: LIST_HINT, example: 'İlkokul' },
  { field: 'bolum', header: 'Sınıf / Şube', kind: 'lookup', lookup: 'bolum', aliases: ['sinif', 'bolum'], description: LIST_HINT, example: '5-A' },
  { field: 'altfirma', header: 'Bina / Alt Kampüs', kind: 'lookup', lookup: 'altfirma', aliases: ['altkampus', 'altfirma'], description: LIST_HINT, example: 'A Blok' },
  COMMON['giristarih'],
];

const PARENT_COLUMNS: ImportColumn[] = [
  { ...COMMON['ad'], description: 'Velinin adı' },
  { ...COMMON['soyad'], description: 'Velinin soyadı' },
  {
    field: 'sicilno',
    header: 'Sicil No',
    kind: 'text',
    description: 'İsteğe bağlı. Boş bırakılırsa sistem otomatik numara üretir.',
    example: '',
  },
  {
    ...COMMON['personelno'],
    description:
      'İsteğe bağlı ama önerilir: veli sistemde zaten kayıtlıysa tekrar eklenmez, sadece yeni öğrenci ilişkileri eklenir. Aynı TC dosyada bir kez geçmelidir.',
  },
  COMMON['dogumtarih'],
  COMMON['cinsiyet'],
  COMMON['kangrubu'],
  COMMON['cardid'],
  COMMON['ceptelefon'],
  COMMON['telefon1'],
  COMMON['email'],
  COMMON['adres'],
  COMMON['il'],
  COMMON['ilce'],
  COMMON['firma'],
  COMMON['giristarih'],
  {
    field: 'ogrenciler',
    header: 'Öğrenci ID(ler)',
    kind: 'students',
    aliases: ['ogrenciid', 'ogrenciler', 'ogrenci'],
    description:
      "Velinin öğrencilerinin ID'leri, ';' ile ayırın. ID'ler 'Öğrenci Listesi' sayfasında. Boş bırakılabilir.",
    example: '239; 241',
  },
];

export function getImportColumns(kind: ImportKind): ImportColumn[] {
  return kind === 'student' ? STUDENT_COLUMNS : PARENT_COLUMNS;
}

/** Kişi türünün DB tip kodu (PersonInsertRequest.userdef). */
export function userdefOf(kind: ImportKind): number {
  return kind === 'student' ? UserDef.Ogrenci : UserDef.Veli;
}

// ─── Metin normalizasyonu ───

/** Büyük/küçük harf ve Türkçe karakter farklarını yok sayan karşılaştırma anahtarı. */
export function normalizeKey(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Başlık eşleştirmesi için ayraç ve işaretleri de atar ("Sınıf / Şube *" → "sinifsube"). */
export function normalizeHeader(value: unknown): string {
  return normalizeKey(value).replace(/[*\s_\-/().]/g, '');
}

/** Hücre değerini düz metne çevirir (sayılar yazıldığı haliyle, boşluklar kırpılır). */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (value instanceof Date) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

// ─── Değer ayrıştırıcıları ───

export type ParseResult = { ok: true; value: string } | { ok: false };

const OK_EMPTY: ParseResult = { ok: true, value: '' };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildIsoDate(year: number, month: number, day: number): ParseResult {
  if (year < 1900 || year > 2100) return { ok: false };
  const probe = new Date(Date.UTC(year, month - 1, day));
  const valid =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return valid ? { ok: true, value: `${year}-${pad2(month)}-${pad2(day)}` } : { ok: false };
}

/**
 * Tarih hücresini 'YYYY-MM-DD'ye çevirir (boş → '').
 * Excel tarih hücreleri seri numarası (number) olarak gelir; UTC aritmetiğiyle
 * çözülür, böylece saat dilimi kaynaklı gün kayması olmaz.
 */
export function parseDateValue(value: unknown): ParseResult {
  if (value === null || value === undefined || value === '') return OK_EMPTY;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { ok: false };
    return buildIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 73050) return { ok: false };
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return buildIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = String(value).trim();
  if (!text) return OK_EMPTY;

  const dayFirst = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (dayFirst) return buildIsoDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));

  const yearFirst = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(text);
  if (yearFirst) return buildIsoDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));

  return { ok: false };
}

/**
 * Cep telefonunu formun maske çıktısıyla aynı biçime (10 hane, baştaki 0 yok) çevirir.
 * '0555…', '+90 555…' ve '555…' yazımlarının hepsi kabul edilir.
 */
export function normalizePhone(value: unknown): ParseResult {
  const text = cellToText(value);
  if (!text) return OK_EMPTY;

  let digits = text.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  return digits.length === 10 ? { ok: true, value: digits } : { ok: false };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "239; 241,242" → benzersiz öğrenci ID'leri; sayı olmayan parçalar `invalid`'e düşer. */
export function parseStudentIds(value: unknown): { ids: number[]; invalid: string[] } {
  const text = cellToText(value);
  const ids: number[] = [];
  const invalid: string[] = [];
  if (!text) return { ids, invalid };

  for (const token of text.split(/[;,\s]+/).filter(Boolean)) {
    if (/^\d+$/.test(token) && Number(token) > 0) {
      const id = Number(token);
      if (!ids.includes(id)) ids.push(id);
    } else {
      invalid.push(token);
    }
  }
  return { ids, invalid };
}

// ─── Liste (lookup) çözümü ───

export interface LookupIndex {
  exact: Map<string, number>;
  loose: Map<string, number>;
}

export function buildLookupIndex(options: LookupOption[]): LookupIndex {
  const exact = new Map<string, number>();
  const loose = new Map<string, number>();
  for (const option of options) {
    for (const name of [option.ad, ...(option.aliases ?? [])]) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      if (!exact.has(trimmed)) exact.set(trimmed, option.id);
      const key = normalizeKey(trimmed);
      if (!loose.has(key)) loose.set(key, option.id);
    }
  }
  return { exact, loose };
}

/** Önce birebir, sonra harf/aksan farkını yok sayarak eşler; bulunamazsa null. */
export function resolveLookup(index: LookupIndex, text: string): number | null {
  const trimmed = text.trim();
  const id = index.exact.get(trimmed) ?? index.loose.get(normalizeKey(trimmed));
  return id === undefined ? null : id;
}

// ─── Sayfa (sheet) ayrıştırma ───

const HEADER_MAPS: Record<ImportKind, Map<string, ImportColumn>> = {
  student: buildHeaderMap(STUDENT_COLUMNS),
  parent: buildHeaderMap(PARENT_COLUMNS),
};

function buildHeaderMap(columns: ImportColumn[]): Map<string, ImportColumn> {
  const map = new Map<string, ImportColumn>();
  for (const column of columns) {
    for (const name of [column.header, column.field, ...(column.aliases ?? [])]) {
      map.set(normalizeHeader(name), column);
    }
  }
  return map;
}

/**
 * Sayfa matrisini (ilk satır başlık) ham satırlara çevirir.
 * Tamamen boş satırlar atlanır; satır numaraları Excel'dekiyle birebir tutulur.
 */
export function parseSheetMatrix(kind: ImportKind, matrix: unknown[][]): ParsedSheet {
  const columns = getImportColumns(kind);
  const headerMap = HEADER_MAPS[kind];
  const headerRow = matrix[0] ?? [];
  const indexByField: Partial<Record<ImportField, number>> = {};
  const unknownHeaders: string[] = [];

  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (!key) return;
    const column = headerMap.get(key);
    if (!column) {
      unknownHeaders.push(cellToText(cell));
    } else if (indexByField[column.field] === undefined) {
      indexByField[column.field] = index;
    }
  });

  const missingRequired = columns
    .filter((column) => column.required && indexByField[column.field] === undefined)
    .map((column) => column.header);

  const rows: RawImportRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    if (!line.some((cell) => cellToText(cell) !== '' || cell instanceof Date)) continue;

    const cells: Partial<Record<ImportField, unknown>> = {};
    for (const column of columns) {
      const index = indexByField[column.field];
      if (index !== undefined) cells[column.field] = line[index];
    }
    rows.push({ rowNo: i + 1, cells });
  }

  return { rows, unknownHeaders, missingRequired };
}

// ─── Doğrulama bağlamı ───

function relationKey(studentId: number, parentId: number): string {
  return `${studentId}:${parentId}`;
}

/** Sistemden okunan kişi ve ilişki listelerinden doğrulamanın ihtiyaç duyduğu yapıları kurar. */
export function buildValidationContext(
  lookups: ImportLookups,
  persons: Person[],
  relations: RelationCampusRow[],
): ValidationContext {
  const existingSchoolNos = new Set<string>();
  const studentIds = new Set<number>();
  const existingParentIdsByTc = new Map<string, number>();

  for (const person of persons) {
    if (person.userdef === UserDef.Ogrenci) {
      studentIds.add(person.id);
      if (person.sicilno) existingSchoolNos.add(normalizeKey(person.sicilno));
    } else if (person.userdef === UserDef.Veli && person.personelno) {
      const tc = normalizeKey(person.personelno);
      if (!existingParentIdsByTc.has(tc)) existingParentIdsByTc.set(tc, person.id);
    }
  }

  const relationKeys = new Set<string>();
  for (const row of relations) {
    const studentId = Number(row.OgrenciSicilId);
    const parentId = Number(row.VeliSicilId);
    if (Number.isFinite(studentId) && Number.isFinite(parentId)) {
      relationKeys.add(relationKey(studentId, parentId));
    }
  }

  return { lookups, existingSchoolNos, studentIds, existingParentIdsByTc, relationKeys };
}

export { relationKey };

// ─── Satır doğrulama ───

type FieldValues = Record<ImportField, string>;

const ALL_FIELDS: ImportField[] = [
  'ad', 'soyad', 'sicilno', 'personelno', 'dogumtarih', 'cinsiyet', 'kangrubu', 'cardid',
  'ceptelefon', 'telefon1', 'email', 'adres', 'il', 'ilce', 'firma', 'direktorluk', 'bolum',
  'altfirma', 'giristarih', 'ogrenciler',
];

function emptyValues(): FieldValues {
  return Object.fromEntries(ALL_FIELDS.map((field) => [field, ''])) as FieldValues;
}

/** İstek paramı '&' ve '=' ile ayrıştırıldığı için bu karakterler değerlerde kullanılamaz. */
const FORBIDDEN_PARAM_CHARS = /[&=]/;

function validateColumn(
  column: ImportColumn,
  cell: unknown,
  indexes: Record<ImportLookupKey, LookupIndex>,
  issues: RowIssue[],
): string {
  const field = column.header;
  const text = cellToText(cell);

  if (column.required && !text) {
    issues.push({ key: 'BULK_IMPORT.ISSUE_REQUIRED', params: { field } });
    return '';
  }

  switch (column.kind) {
    case 'students':
      return ''; // İlişki kolonu satır düzeyinde işlenir.
    case 'date': {
      const result = parseDateValue(cell);
      if (!result.ok) {
        issues.push({ key: 'BULK_IMPORT.ISSUE_INVALID_DATE', params: { field, value: text } });
        return '';
      }
      return result.value;
    }
    case 'phone': {
      const result = normalizePhone(cell);
      if (!result.ok) {
        issues.push({ key: 'BULK_IMPORT.ISSUE_INVALID_PHONE', params: { field, value: text } });
        return '';
      }
      return result.value;
    }
    case 'lookup': {
      if (!text) return '';
      const id = resolveLookup(indexes[column.lookup!], text);
      if (id === null) {
        issues.push({ key: 'BULK_IMPORT.ISSUE_LOOKUP_NOT_FOUND', params: { field, value: text } });
        return '';
      }
      return String(id);
    }
    case 'email':
      if (text && !EMAIL_PATTERN.test(text)) {
        issues.push({ key: 'BULK_IMPORT.ISSUE_INVALID_EMAIL', params: { field, value: text } });
        return '';
      }
      break;
    case 'tc':
      if (text && !/^\d{11}$/.test(text)) {
        issues.push({ key: 'BULK_IMPORT.ISSUE_INVALID_TC', params: { field, value: text } });
        return '';
      }
      break;
  }

  if (FORBIDDEN_PARAM_CHARS.test(text)) {
    issues.push({ key: 'BULK_IMPORT.ISSUE_FORBIDDEN_CHARS', params: { field } });
    return '';
  }
  return text;
}

function buildPayload(kind: ImportKind, values: FieldValues): PersonInsertRequest {
  return {
    ad: values.ad,
    soyad: values.soyad,
    dogumtarih: values.dogumtarih,
    cinsiyet: values.cinsiyet,
    kangrubu: values.kangrubu,
    sicilno: values.sicilno,
    personelno: values.personelno,
    cardid: values.cardid,
    ceptelefon: values.ceptelefon,
    telefon1: values.telefon1,
    email: values.email,
    adres: values.adres,
    il: values.il,
    ilce: values.ilce,
    firma: values.firma,
    direktorluk: values.direktorluk,
    bolum: values.bolum,
    altfirma: values.altfirma,
    giristarih: values.giristarih,
    userdef: userdefOf(kind),
    fotoImage: null,
  };
}

/** Velinin "Öğrenci ID(ler)" hücresini çözer; geçersiz/bulunamayan ID'leri `issues`'a yazar. */
function resolveStudentRefs(
  cell: unknown,
  context: ValidationContext,
  issues: RowIssue[],
): number[] {
  const { ids, invalid } = parseStudentIds(cell);
  for (const token of invalid) {
    issues.push({ key: 'BULK_IMPORT.ISSUE_INVALID_STUDENT_ID', params: { value: token } });
  }
  const resolved: number[] = [];
  for (const id of ids) {
    if (context.studentIds.has(id)) resolved.push(id);
    else issues.push({ key: 'BULK_IMPORT.ISSUE_STUDENT_NOT_FOUND', params: { id } });
  }
  return resolved;
}

/**
 * Ham satırları doğrular ve kaydedilebilir hale getirir. Hiçbir istek atmaz.
 *
 * Öğrenci: sistemde var > hata > eklenecek (var olan satır tamamen atlanır).
 * Veli: hata > var > eklenecek. Mevcut veli eklenmez ama satırdaki yeni öğrenci
 * ilişkileri kurulur; bu yüzden öğrenci referansı hataları mevcut velide de geçerlidir.
 */
export function validateImportRows(
  kind: ImportKind,
  rawRows: RawImportRow[],
  context: ValidationContext,
): ImportRow[] {
  const columns = getImportColumns(kind);
  const indexes = Object.fromEntries(
    (Object.keys(context.lookups) as ImportLookupKey[]).map((key) => [
      key,
      buildLookupIndex(context.lookups[key]),
    ]),
  ) as Record<ImportLookupKey, LookupIndex>;

  const firstRowByKey = new Map<string, number>();

  return rawRows.map((raw): ImportRow => {
    const fieldIssues: RowIssue[] = [];
    const values = emptyValues();

    for (const column of columns) {
      values[column.field] = validateColumn(column, raw.cells[column.field], indexes, fieldIssues);
    }

    // Tekrar anahtarı: öğrencide Okul No, velide TC.
    const keyValue = kind === 'student' ? values.sicilno : values.personelno;
    const key = normalizeKey(keyValue);
    const rowIssues: RowIssue[] = [];
    let existingId: number | null = null;
    let exists = false;

    if (key) {
      const firstRow = firstRowByKey.get(key);
      if (firstRow !== undefined) {
        rowIssues.push({
          key:
            kind === 'student'
              ? 'BULK_IMPORT.ISSUE_DUPLICATE_IN_FILE'
              : 'BULK_IMPORT.ISSUE_DUPLICATE_TC_IN_FILE',
          params: { row: firstRow },
        });
      } else {
        firstRowByKey.set(key, raw.rowNo);
        if (kind === 'student') {
          exists = context.existingSchoolNos.has(key);
        } else {
          existingId = context.existingParentIdsByTc.get(key) ?? null;
          exists = existingId !== null;
        }
      }
    }

    const base = { rowNo: raw.rowNo, ad: values.ad, soyad: values.soyad, key: keyValue };
    const noRelations = { existingId, relationStudentIds: [] as number[], alreadyLinked: 0 };

    if (kind === 'student') {
      if (exists) {
        return {
          ...base,
          ...noRelations,
          payload: null,
          status: 'exists',
          issues: [{ key: 'BULK_IMPORT.ISSUE_EXISTS' }],
        };
      }
      const issues = [...fieldIssues, ...rowIssues];
      if (issues.length > 0) return { ...base, ...noRelations, payload: null, status: 'error', issues };
      return { ...base, ...noRelations, payload: buildPayload(kind, values), status: 'ready', issues };
    }

    // Veli: önce ilişki hücresi, sonra durum.
    const studentRefIssues: RowIssue[] = [];
    const studentIds = resolveStudentRefs(raw.cells['ogrenciler'], context, studentRefIssues);
    // Mevcut velide alan hataları önemsizdir (veli güncellenmez); sadece ilişki ve tekrar hataları sayılır.
    const issues = exists
      ? [...rowIssues, ...studentRefIssues]
      : [...fieldIssues, ...rowIssues, ...studentRefIssues];

    const linkedFilter = (studentId: number): boolean =>
      existingId !== null && context.relationKeys.has(relationKey(studentId, existingId));
    const alreadyLinked = studentIds.filter(linkedFilter).length;
    const relationStudentIds = studentIds.filter((id) => !linkedFilter(id));
    const relationInfo = { existingId, relationStudentIds, alreadyLinked };

    if (issues.length > 0) {
      return { ...base, ...relationInfo, payload: null, status: 'error', issues };
    }
    if (exists) {
      return {
        ...base,
        ...relationInfo,
        payload: null,
        status: 'exists',
        issues: [
          relationStudentIds.length > 0
            ? { key: 'BULK_IMPORT.ISSUE_EXISTS_PARENT_LINK', params: { count: relationStudentIds.length } }
            : { key: 'BULK_IMPORT.ISSUE_EXISTS_PARENT' },
        ],
      };
    }
    return { ...base, ...relationInfo, payload: buildPayload(kind, values), status: 'ready', issues };
  });
}
