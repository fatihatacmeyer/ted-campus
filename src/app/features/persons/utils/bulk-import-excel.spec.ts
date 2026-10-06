import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { ImportFileError, hasExcelSignature, readImportWorkbook } from './bulk-import-excel';

function makeXlsx(rows: unknown[][], sheetName = 'Öğrenciler'): File {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], 'liste.xlsx');
}

async function failureKey(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ImportFileError) return error.issue.key;
    throw error;
  }
  return 'NO_ERROR';
}

describe('readImportWorkbook', () => {
  it('öğrenci şablonunu satır numaralarıyla okur', async () => {
    const parsed = await readImportWorkbook(
      makeXlsx([
        ['Ad *', 'Soyad *', 'Okul No', 'Sınıf / Şube', 'Doğum Tarihi'],
        ['excel', 'excel', 1001, '5-A', '15.03.2012'],
        ['', '', '', '', ''],
        ['Ali', 'Kaya', '', '', ''],
      ]),
      'student',
    );
    expect(parsed.rows.map((r) => r.rowNo)).toEqual([2, 4]);
    expect(parsed.rows[0].cells).toMatchObject({ ad: 'excel', sicilno: 1001, bolum: '5-A' });
  });

  it('veli şablonunu ve ilişki sütununu okur', async () => {
    const parsed = await readImportWorkbook(
      makeXlsx(
        [
          ['Ad *', 'Soyad *', 'TC Kimlik No', 'Öğrenci ID(ler)'],
          ['Ayşe', 'Yılmaz', '11111111111', '239; 240'],
        ],
        'Veliler',
      ),
      'parent',
    );
    expect(parsed.rows[0].cells).toMatchObject({ personelno: '11111111111', ogrenciler: '239; 240' });
  });

  it('Excel tarih hücresini seri numarası olarak verir', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Ad', 'Soyad', 'Doğum Tarihi'], ['A', 'B', '']]);
    sheet['C2'] = { t: 'd', v: new Date(Date.UTC(2012, 2, 15)), z: 'dd.mm.yyyy' };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Öğrenciler');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const parsed = await readImportWorkbook(new File([bytes], 'x.xlsx'), 'student');
    expect(typeof parsed.rows[0].cells.dogumtarih).toBe('number');
  });

  it('eksik zorunlu sütunu, uzantıyı ve sahte dosyayı reddeder', async () => {
    expect(await failureKey(readImportWorkbook(makeXlsx([['Ad'], ['x']]), 'student'))).toBe(
      'BULK_IMPORT.ERR_MISSING_COLUMNS',
    );
    expect(await failureKey(readImportWorkbook(new File(['x'], 'a.txt'), 'student'))).toBe(
      'BULK_IMPORT.ERR_FILE_TYPE',
    );
    expect(await failureKey(readImportWorkbook(new File(['düz metin'], 'a.xlsx'), 'student'))).toBe(
      'BULK_IMPORT.ERR_FILE_SIGNATURE',
    );
    expect(await failureKey(readImportWorkbook(makeXlsx([['Ad', 'Soyad']]), 'student'))).toBe(
      'BULK_IMPORT.ERR_FILE_EMPTY',
    );
  });
});

describe('hasExcelSignature', () => {
  it('zip ve OLE imzalarını tanır', () => {
    expect(hasExcelSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe(true);
    expect(
      hasExcelSignature(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])),
    ).toBe(true);
    expect(hasExcelSignature(new Uint8Array([1, 2, 3, 4, 5]))).toBe(false);
  });
});
