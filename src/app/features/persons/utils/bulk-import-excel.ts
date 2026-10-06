import * as XLSX from 'xlsx';
import { Person } from '../../../core/models/person.model';
import { ImportKind, ImportLookups, ParsedSheet, RowIssue } from '../models/bulk-import.model';
import {
  MAX_IMPORT_ROWS,
  getImportColumns,
  normalizeKey,
  parseSheetMatrix,
} from './bulk-import.utils';

const DATA_SHEET: Record<ImportKind, string> = { student: 'Öğrenciler', parent: 'Veliler' };
const TEMPLATE_FILE: Record<ImportKind, string> = {
  student: 'ogrenci-aktarim-sablonu.xlsx',
  parent: 'veli-aktarim-sablonu.xlsx',
};
const GUIDE_SHEET = 'Açıklama';
const LISTS_SHEET = 'Listeler';
const STUDENTS_SHEET = 'Öğrenci Listesi';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Kullanıcıya gösterilecek, çevrilebilir dosya hatası. */
export class ImportFileError extends Error {
  constructor(public readonly issue: RowIssue) {
    super(issue.key);
  }
}

/** .xlsx (ZIP) veya .xls (OLE2) imzasını kontrol eder; uzantısı değiştirilmiş dosyaları eler. */
export function hasExcelSignature(bytes: Uint8Array): boolean {
  const isZip =
    bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const isOle =
    bytes.length > 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1;
  return isZip || isOle;
}

/** Yüklenen Excel dosyasını okuyup doğrulamaya hazır hale getirir. */
export async function readImportWorkbook(file: File, kind: ImportKind): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    throw new ImportFileError({ key: 'BULK_IMPORT.ERR_FILE_TYPE' });
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError({ key: 'BULK_IMPORT.ERR_FILE_TOO_LARGE', params: { max: 5 } });
  }

  const buffer = await file.arrayBuffer();
  if (!hasExcelSignature(new Uint8Array(buffer))) {
    throw new ImportFileError({ key: 'BULK_IMPORT.ERR_FILE_SIGNATURE' });
  }

  let matrix: unknown[][];
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName =
      workbook.SheetNames.find((n) => normalizeKey(n) === normalizeKey(DATA_SHEET[kind])) ??
      workbook.SheetNames[0];
    // blankrows: true → satır numaraları Excel'deki ile birebir kalır.
    matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      blankrows: true,
      raw: true,
    });
  } catch {
    throw new ImportFileError({ key: 'BULK_IMPORT.ERR_READ_FILE' });
  }

  const parsed = parseSheetMatrix(kind, matrix);
  if (parsed.missingRequired.length > 0) {
    throw new ImportFileError({
      key: 'BULK_IMPORT.ERR_MISSING_COLUMNS',
      params: { columns: parsed.missingRequired.join(', ') },
    });
  }
  if (parsed.rows.length === 0) {
    throw new ImportFileError({ key: 'BULK_IMPORT.ERR_FILE_EMPTY' });
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError({
      key: 'BULK_IMPORT.ERR_TOO_MANY_ROWS',
      params: { max: MAX_IMPORT_ROWS },
    });
  }
  return parsed;
}

function columnWidths(rows: string[][]): XLSX.ColInfo[] {
  const count = Math.max(...rows.map((r) => r.length));
  return Array.from({ length: count }, (_, i) => ({
    wch: Math.min(Math.max(...rows.map((r) => (r[i] ?? '').length)) + 2, 60),
  }));
}

function kindRules(kind: ImportKind): string[] {
  const common = [
    "• Kampüs, Cinsiyet ve Kan Grubu gibi liste alanlarında 'Listeler' sayfasındaki değerleri yazın (büyük/küçük harf ve Türkçe karakter farkı önemsenmez).",
    '• Tarihler GG.AA.YYYY biçiminde veya Excel tarih hücresi olarak girilebilir.',
    "• Hiçbir alanda '&' ve '=' karakterleri kullanılamaz.",
    `• Tek dosyada en fazla ${MAX_IMPORT_ROWS} satır aktarılabilir.`,
    "• Sütun başlıklarını ve sırasını değiştirmeyin; veriyi ilk sayfaya girin.",
  ];
  if (kind === 'student') {
    return [
      '• Yalnızca Ad ve Soyad zorunludur. Okul No boş bırakılırsa sistem otomatik numara üretir.',
      '• Okul No sistemde zaten kayıtlıysa o satır atlanır (güncellenmez).',
      "• Okul No'daki baştaki sıfırların korunması için hücreyi 'Metin' biçimine alın.",
      ...common,
    ];
  }
  return [
    '• Yalnızca Ad ve Soyad zorunludur. Öğrenciler sistemde önceden kayıtlı olmalıdır.',
    "• 'Öğrenci ID(ler)' hücresine velinin öğrencilerinin ID'lerini yazın; birden fazlaysa ';' ile ayırın (örn. 239; 241). ID'ler 'Öğrenci Listesi' sayfasındadır.",
    '• Önce veliler eklenir, sonra öğrenci ilişkileri kurulur.',
    '• TC Kimlik No ile sistemde kayıtlı bir veli bulunursa veli tekrar eklenmez; sadece yeni öğrenci ilişkileri eklenir.',
    '• Aynı TC Kimlik No dosyada bir kez geçmelidir; velinin tüm öğrencilerini tek hücrede yazın.',
    '• Sistemde zaten var olan veli–öğrenci ilişkileri tekrar eklenmez.',
    ...common,
  ];
}

/** Güncel liste değerleriyle doldurulmuş şablonu indirir (veli şablonuna öğrenci listesi de eklenir). */
export function downloadImportTemplate(
  kind: ImportKind,
  lookups: ImportLookups,
  students: Person[] = [],
): void {
  const columns = getImportColumns(kind);
  const workbook = XLSX.utils.book_new();

  // 1) Veri sayfası: yalnızca başlıklar (zorunlu olanlar '*' ile işaretli).
  const headers = columns.map((c) => (c.required ? `${c.header} *` : c.header));
  const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
  dataSheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, DATA_SHEET[kind]);

  // 2) Açıklama sayfası: alan tablosu + kurallar.
  const title = kind === 'student' ? 'Öğrenci Aktarım Şablonu' : 'Veli Aktarım Şablonu';
  const guideRows: string[][] = [
    [title],
    [''],
    ['Başlık', 'Zorunlu', 'Açıklama', 'Örnek'],
    ...columns.map((c) => [c.header, c.required ? 'Evet' : 'Hayır', c.description, c.example]),
    [''],
    ['Kurallar'],
    ...kindRules(kind).map((rule) => [rule]),
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 70 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, GUIDE_SHEET);

  // 3) Listeler sayfası: yalnızca bu şablonda kullanılan listeler, her biri ayrı sütun.
  const usedLookups = new Set(columns.map((c) => c.lookup).filter(Boolean));
  const listColumns = columns
    .filter((c) => c.lookup && usedLookups.has(c.lookup))
    .map((c) => ({ title: c.header, values: lookups[c.lookup!].map((o) => o.ad) }));
  const height = Math.max(0, ...listColumns.map((c) => c.values.length));
  const listRows: string[][] = [listColumns.map((c) => c.title)];
  for (let i = 0; i < height; i++) {
    listRows.push(listColumns.map((c) => c.values[i] ?? ''));
  }
  const listSheet = XLSX.utils.aoa_to_sheet(listRows);
  listSheet['!cols'] = columnWidths(listRows);
  XLSX.utils.book_append_sheet(workbook, listSheet, LISTS_SHEET);

  // 4) Öğrenci Listesi: veli şablonunda ilişki ID'lerini bulmak için başvuru sayfası.
  if (kind === 'parent') {
    const sorted = [...students].sort(
      (a, b) =>
        (a.bolumad ?? '').localeCompare(b.bolumad ?? '', 'tr') ||
        (a.soyad ?? '').localeCompare(b.soyad ?? '', 'tr') ||
        (a.ad ?? '').localeCompare(b.ad ?? '', 'tr'),
    );
    const studentRows: (string | number)[][] = [
      ['ID', 'Okul No', 'Ad', 'Soyad', 'Sınıf / Şube', 'Kampüs'],
      ...sorted.map((s) => [s.id, s.sicilno ?? '', s.ad ?? '', s.soyad ?? '', s.bolumad ?? '', s.firmaad ?? '']),
    ];
    const studentSheet = XLSX.utils.aoa_to_sheet(studentRows);
    studentSheet['!cols'] = columnWidths(studentRows.map((r) => r.map(String)));
    XLSX.utils.book_append_sheet(workbook, studentSheet, STUDENTS_SHEET);
  }

  XLSX.writeFile(workbook, TEMPLATE_FILE[kind]);
}
