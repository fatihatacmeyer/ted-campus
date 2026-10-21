import { describe, expect, it } from 'vitest';
import { Person } from '../../../core/models/person.model';
import { ImportKind, ImportLookups, ValidationOptions } from '../models/bulk-import.model';
import {
  ERROR_COLUMN_HEADER,
  buildFixSheetRows,
  buildLookupIndex,
  buildValidationContext,
  normalizeHeader,
  normalizeKey,
  normalizePhone,
  parseDateValue,
  parseSheetMatrix,
  parseStudentIds,
  resolveLookup,
  validateImportRows,
} from './bulk-import.utils';

const LOOKUPS: ImportLookups = {
  firma: [{ id: 1, ad: 'Merkez Kampüs' }],
  direktorluk: [{ id: 2, ad: 'İlkokul' }],
  bolum: [
    { id: 10, ad: '5-A' },
    { id: 11, ad: '5-B' },
  ],
  altfirma: [{ id: 3, ad: 'A Blok' }],
  cinsiyet: [
    { id: 1, ad: 'Erkek', aliases: ['E'] },
    { id: 2, ad: 'Kadın', aliases: ['K'] },
  ],
  kangrubu: [{ id: 5, ad: 'A Rh+' }],
};

function person(partial: Partial<Person>): Person {
  return partial as Person;
}

const PERSONS: Person[] = [
  person({ id: 239, userdef: 11, sicilno: '1001', personelno: '44444444444' }),
  person({ id: 240, userdef: 11, sicilno: '1002', personelno: '55555555555' }),
  person({ id: 500, userdef: 12, personelno: '11111111111' }),
];
const RELATIONS = [{ VeliSicilId: 500, OgrenciSicilId: 239 }];

function validate(
  kind: ImportKind,
  cells: Record<string, unknown>[],
  persons: Person[] = PERSONS,
  relations = RELATIONS,
  options: ValidationOptions = {},
) {
  return validateImportRows(
    kind,
    cells.map((c, i) => ({ rowNo: i + 2, cells: c })),
    buildValidationContext(LOOKUPS, persons, relations),
    options,
  );
}

describe('normalizeKey / normalizeHeader', () => {
  it('harf ve Türkçe karakter farklarını yok sayar', () => {
    expect(normalizeKey('  İSTANBUL ')).toBe('istanbul');
    expect(normalizeKey('Istanbul')).toBe(normalizeKey('İstanbul'));
    expect(normalizeKey('Şişli ÇAĞ')).toBe('sisli cag');
  });

  it('başlıklardan ayraç ve işaretleri atar', () => {
    expect(normalizeHeader('Sınıf / Şube *')).toBe('sinifsube');
    expect(normalizeHeader('Öğrenci ID(ler)')).toBe('ogrenciidler');
  });
});

describe('parseDateValue', () => {
  it('Excel seri numarasını çözer', () => {
    expect(parseDateValue(45000)).toEqual({ ok: true, value: '2023-03-15' });
  });

  it('metin biçimlerini kabul eder', () => {
    expect(parseDateValue('15.03.2012')).toEqual({ ok: true, value: '2012-03-15' });
    expect(parseDateValue('5/9/2024')).toEqual({ ok: true, value: '2024-09-05' });
    expect(parseDateValue('2012-03-15')).toEqual({ ok: true, value: '2012-03-15' });
  });

  it('boşu boş döner, geçersizi reddeder', () => {
    expect(parseDateValue('')).toEqual({ ok: true, value: '' });
    expect(parseDateValue('31.02.2020')).toEqual({ ok: false });
    expect(parseDateValue('abc')).toEqual({ ok: false });
  });
});

describe('normalizePhone', () => {
  it('farklı yazımları 10 haneye çevirir', () => {
    expect(normalizePhone('0555 123 45 67')).toEqual({ ok: true, value: '5551234567' });
    expect(normalizePhone('+90 (555) 123-45-67')).toEqual({ ok: true, value: '5551234567' });
    expect(normalizePhone(5551234567)).toEqual({ ok: true, value: '5551234567' });
  });

  it('eksik hane ve boşu doğru ele alır', () => {
    expect(normalizePhone('')).toEqual({ ok: true, value: '' });
    expect(normalizePhone('12345')).toEqual({ ok: false });
  });
});

describe('resolveLookup', () => {
  it('birebir ve gevşek eşleşir, takma ad çözer', () => {
    const index = buildLookupIndex(LOOKUPS.cinsiyet);
    expect(resolveLookup(index, 'Kadın')).toBe(2);
    expect(resolveLookup(index, 'kadin')).toBe(2);
    expect(resolveLookup(index, 'E')).toBe(1);
    expect(resolveLookup(index, 'bilinmiyor')).toBeNull();
  });
});

describe('parseStudentIds', () => {
  it('ayırıcıları kabul eder, tekrarı eler, geçersizi ayırır', () => {
    expect(parseStudentIds('239; 241,242  239')).toEqual({ ids: [239, 241, 242], invalid: [] });
    expect(parseStudentIds(239)).toEqual({ ids: [239], invalid: [] });
    expect(parseStudentIds('12a; 0; -3')).toEqual({ ids: [], invalid: ['12a', '0', '-3'] });
    expect(parseStudentIds('')).toEqual({ ids: [], invalid: [] });
  });
});

describe('parseSheetMatrix', () => {
  it('başlıkları eşler, boş satırı atlar ve Excel satır numarasını korur', () => {
    const parsed = parseSheetMatrix('student', [
      ['Ad *', 'Soyad *', 'TC Kimlik No *', 'Sınıf / Şube', 'Gereksiz'],
      ['Ayşe', 'Yılmaz', '12345678901', '5-A', 'x'],
      ['', '', '', '', ''],
      ['Ali', 'Kaya', '12345678902', '', ''],
    ]);
    expect(parsed.missingRequired).toEqual([]);
    expect(parsed.unknownHeaders).toEqual(['Gereksiz']);
    expect(parsed.rows.map((r) => r.rowNo)).toEqual([2, 4]);
    expect(parsed.rows[0].cells.bolum).toBe('5-A');
  });

  it('zorunlu sütun eksikse bildirir', () => {
    expect(parseSheetMatrix('student', [['Ad']]).missingRequired).toEqual(['Soyad', 'TC Kimlik No']);
  });

  it('veli şablonunda ilişki sütununu tanır, öğrenciye özgü sütunu tanımaz', () => {
    const parsed = parseSheetMatrix('parent', [
      ['Ad *', 'Soyad *', 'Öğrenci ID(ler)', 'Sınıf / Şube'],
      ['Ayşe', 'Yılmaz', '239; 240', '5-A'],
    ]);
    expect(parsed.rows[0].cells.ogrenciler).toBe('239; 240');
    expect(parsed.unknownHeaders).toEqual(['Sınıf / Şube']);
  });
});

describe('validateImportRows (öğrenci)', () => {
  it('yalnızca ad-soyad ile kaydedilebilir satır üretir', () => {
    const [row] = validate('student', [
      { ad: 'excel', soyad: 'excel', personelno: '12345678901' },
    ]);
    expect(row.status).toBe('ready');
    expect(row.payload).toMatchObject({ ad: 'excel', soyad: 'excel', userdef: 11, sicilno: '', personelno: '12345678901' });
  });

  it('liste alanlarını ID olarak yazar, telefonu ve tarihi dönüştürür', () => {
    const [row] = validate('student', [
      {
        ad: 'Ayşe',
        soyad: 'Yılmaz',
        personelno: '12345678901',
        bolum: '5-a',
        firma: 'merkez kampus',
        cinsiyet: 'K',
        ceptelefon: '0555 123 45 67',
        dogumtarih: 45000,
      },
    ]);
    expect(row.status).toBe('ready');
    expect(row.payload).toMatchObject({
      bolum: '10',
      firma: '1',
      cinsiyet: '2',
      ceptelefon: '5551234567',
      dogumtarih: '2023-03-15',
    });
  });

  it('zorunlu alan ve bulunamayan liste değerini hata sayar', () => {
    const [missing, badLookup] = validate('student', [
      { ad: 'Ali' },
      { ad: 'A', soyad: 'B', personelno: '12345678901', bolum: '9-Z' },
    ]);
    expect(missing.status).toBe('error');
    expect(missing.issues[0].key).toBe('BULK_IMPORT.ISSUE_REQUIRED');
    expect(badLookup.status).toBe('error');
    expect(badLookup.issues[0].key).toBe('BULK_IMPORT.ISSUE_LOOKUP_NOT_FOUND');
  });

  it("'&' ve '=' içeren değeri reddeder", () => {
    const [row] = validate('student', [{ ad: 'A', soyad: 'B', personelno: '12345678901', adres: 'Gül & Sok.' }]);
    expect(row.status).toBe('error');
    expect(row.issues[0].key).toBe('BULK_IMPORT.ISSUE_FORBIDDEN_CHARS');
  });

  it('geçersiz TC ve e-postayı hata sayar', () => {
    const [row] = validate('student', [{ ad: 'A', soyad: 'B', personelno: '123', email: 'x@' }]);
    expect(row.issues.map((i) => i.key)).toEqual([
      'BULK_IMPORT.ISSUE_INVALID_TC',
      'BULK_IMPORT.ISSUE_INVALID_EMAIL',
    ]);
  });

  it('TC boşsa satırı hata sayar', () => {
    const [row] = validate('student', [{ ad: 'A', soyad: 'B' }]);
    expect(row.status).toBe('error');
    expect(row.issues[0]).toMatchObject({
      key: 'BULK_IMPORT.ISSUE_REQUIRED',
      params: { field: 'TC Kimlik No' },
    });
  });

  it('sistemde var olan TC satırını atlar, dosyadaki tekrarı hata sayar', () => {
    const rows = validate('student', [
      { ad: 'A', soyad: 'B', personelno: '44444444444' },
      { ad: 'C', soyad: 'D', personelno: '66666666666' },
      { ad: 'E', soyad: 'F', personelno: '66666666666' },
    ]);
    expect(rows.map((r) => r.status)).toEqual(['exists', 'ready', 'error']);
    expect(rows[2].issues[0]).toMatchObject({
      key: 'BULK_IMPORT.ISSUE_DUPLICATE_IN_FILE',
      params: { row: 3 },
    });
  });

  it("Okul No aynı olsa da farklı TC'li öğrencileri ekler", () => {
    const rows = validate('student', [
      { ad: 'A', soyad: 'B', sicilno: '1001', personelno: '77777777777' },
      { ad: 'C', soyad: 'D', sicilno: '1001', personelno: '88888888888' },
    ]);
    expect(rows.map((r) => r.status)).toEqual(['ready', 'ready']);
  });
});

describe('validateImportRows (öğrenci güncelleme)', () => {
  const UPDATE = { updateExisting: true };
  const EXISTING = person({
    id: 300,
    userdef: 11,
    ad: 'Ayşe',
    soyad: 'Yılmaz',
    sicilno: '1001',
    personelno: '99999999999',
    ceptelefon: '05551234567',
    email: 'eski@ornek.com',
    adres: 'Eski Mah.',
    dogumtarih: '2012-03-15T00:00:00',
    cinsiyet: 'K',
    firma: '1',
    bolum: '10',
    pozisyon: '7',
    gorev: '8',
    yaka: '9',
    okod1: 'x',
  });
  const persons = [...PERSONS, EXISTING];

  it('onay kutusu kapalıyken mevcut TC satırını bugünkü gibi atlar', () => {
    const [row] = validate(
      'student',
      [{ ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', email: 'yeni@ornek.com' }],
      persons,
    );
    expect(row.status).toBe('exists');
    expect(row.issues[0].key).toBe('BULK_IMPORT.ISSUE_EXISTS');
  });

  it('açıkken tek eşleşmeyi günceller; boş hücre mevcut değeri korur', () => {
    const [row] = validate(
      'student',
      [{ ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', email: 'yeni@ornek.com' }],
      persons,
      RELATIONS,
      UPDATE,
    );
    expect(row.status).toBe('update');
    expect(row.existingId).toBe(300);
    expect(row.issues[0]).toMatchObject({
      key: 'BULK_IMPORT.ISSUE_WILL_UPDATE',
      params: { fields: 'E-posta' },
    });
    expect(row.payload).toMatchObject({
      email: 'yeni@ornek.com',
      adres: 'Eski Mah.',
      ceptelefon: '5551234567',
      dogumtarih: '2012-03-15',
      cinsiyet: '2',
      firma: '1',
      bolum: '10',
      sicilno: '1001',
      pozisyon: '7',
      gorev: '8',
      yaka: '9',
      okod1: 'x',
      userdef: 11,
    });
  });

  it('hiçbir değer farklı değilse satırı atlar', () => {
    const [row] = validate(
      'student',
      [{ ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', cinsiyet: 'Kadın', bolum: '5-A' }],
      persons,
      RELATIONS,
      UPDATE,
    );
    expect(row.status).toBe('exists');
    expect(row.issues[0].key).toBe('BULK_IMPORT.ISSUE_EXISTS_NO_CHANGES');
  });

  it('listede aynı kayıt tekrar gelse de tek öğrenci sayar ve günceller', () => {
    const [row] = validate(
      'student',
      [{ ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', bolum: '5-B' }],
      [...persons, EXISTING],
      RELATIONS,
      UPDATE,
    );
    expect(row.status).toBe('update');
    expect(row.payload).toMatchObject({ bolum: '11', email: 'eski@ornek.com' });
    expect(row.issues[0].params).toEqual({ fields: 'Sınıf / Şube' });
    expect(row.changes).toEqual([{ field: 'Sınıf / Şube', from: '5-A', to: '5-B' }]);
  });

  it('değişiklikte tarihi GG.AA.YYYY, boş eski değeri boş metin olarak verir', () => {
    const [row] = validate(
      'student',
      [{ ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', dogumtarih: '16.03.2012', il: 'İzmir' }],
      persons,
      RELATIONS,
      UPDATE,
    );
    expect(row.changes).toEqual([
      { field: 'Doğum Tarihi', from: '15.03.2012', to: '16.03.2012' },
      { field: 'İl', from: '', to: 'İzmir' },
    ]);
  });

  it('aynı TC ile birden fazla öğrenci varsa güncellemez', () => {
    const twin = person({ id: 301, userdef: 11, personelno: '99999999999' });
    const [row] = validate(
      'student',
      [{ ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', email: 'yeni@ornek.com' }],
      [...persons, twin],
      RELATIONS,
      UPDATE,
    );
    expect(row.status).toBe('exists');
    expect(row.payload).toBeNull();
    expect(row.issues[0]).toMatchObject({
      key: 'BULK_IMPORT.ISSUE_EXISTS_MULTIPLE',
      params: { count: 2 },
    });
  });

  it('güncellenecek satırda alan hatası varsa hata sayar', () => {
    const [row] = validate(
      'student',
      [{ ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', email: 'x@' }],
      persons,
      RELATIONS,
      UPDATE,
    );
    expect(row.status).toBe('error');
    expect(row.issues[0].key).toBe('BULK_IMPORT.ISSUE_INVALID_EMAIL');
  });

  it('dosyada tekrarlanan TC ikinci satırı güncellemede de hata sayar', () => {
    const rows = validate(
      'student',
      [
        { ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', email: 'a@ornek.com' },
        { ad: 'Ayşe', soyad: 'Yılmaz', personelno: '99999999999', email: 'b@ornek.com' },
      ],
      persons,
      RELATIONS,
      UPDATE,
    );
    expect(rows.map((r) => r.status)).toEqual(['update', 'error']);
  });

  it('yeni TC\'li satır güncelleme açıkken de eklenir', () => {
    const [row] = validate(
      'student',
      [{ ad: 'Yeni', soyad: 'Kişi', personelno: '12312312312' }],
      persons,
      RELATIONS,
      UPDATE,
    );
    expect(row.status).toBe('ready');
  });
});

describe('validateImportRows (veli)', () => {
  it('yeni veliyi userdef 12 ile hazırlar ve öğrencileri çözer', () => {
    const [row] = validate('parent', [
      { ad: 'Ayşe', soyad: 'Yılmaz', personelno: '22222222222', ogrenciler: '239; 240' },
    ]);
    expect(row.status).toBe('ready');
    expect(row.payload).toMatchObject({ userdef: 12, personelno: '22222222222' });
    expect(row.relationStudentIds).toEqual([239, 240]);
    expect(row.key).toBe('22222222222');
  });

  it('öğrenci belirtilmeyen veliyi yine de kaydedilebilir sayar', () => {
    const [row] = validate('parent', [{ ad: 'A', soyad: 'B' }]);
    expect(row.status).toBe('ready');
    expect(row.relationStudentIds).toEqual([]);
  });

  it('bulunamayan ve geçersiz öğrenci ID satırı hatalı yapar', () => {
    const [notFound, invalid] = validate('parent', [
      { ad: 'A', soyad: 'B', ogrenciler: '239; 9999' },
      { ad: 'C', soyad: 'D', ogrenciler: 'abc' },
    ]);
    expect(notFound.status).toBe('error');
    expect(notFound.issues[0]).toMatchObject({
      key: 'BULK_IMPORT.ISSUE_STUDENT_NOT_FOUND',
      params: { id: 9999 },
    });
    expect(invalid.status).toBe('error');
    expect(invalid.issues[0].key).toBe('BULK_IMPORT.ISSUE_INVALID_STUDENT_ID');
  });

  it('mevcut veliyi eklemez ama yeni ilişkileri kurar, var olanı atlar', () => {
    const [row] = validate('parent', [
      { ad: 'X', soyad: 'Y', personelno: '11111111111', ogrenciler: '239; 240' },
    ]);
    expect(row.status).toBe('exists');
    expect(row.payload).toBeNull();
    expect(row.existingId).toBe(500);
    expect(row.relationStudentIds).toEqual([240]);
    expect(row.alreadyLinked).toBe(1);
    expect(row.issues[0].key).toBe('BULK_IMPORT.ISSUE_EXISTS_PARENT_LINK');
  });

  it('mevcut velide yeni ilişki yoksa bilgi mesajı verir', () => {
    const [row] = validate('parent', [
      { ad: 'X', soyad: 'Y', personelno: '11111111111', ogrenciler: '239' },
    ]);
    expect(row.status).toBe('exists');
    expect(row.relationStudentIds).toEqual([]);
    expect(row.issues[0].key).toBe('BULK_IMPORT.ISSUE_EXISTS_PARENT');
  });

  it('mevcut velide alan hatalarını önemsemez ama öğrenci hatasını sayar', () => {
    const [okRow, badRow] = validate('parent', [
      { ad: 'X', soyad: 'Y', personelno: '11111111111', ceptelefon: 'abc', ogrenciler: '240' },
      { ad: 'X', soyad: 'Y', personelno: '11111111111', ogrenciler: '9999' },
    ]);
    expect(okRow.status).toBe('exists');
    expect(badRow.status).toBe('error');
  });

  it('dosyada tekrarlanan TC ikinci satırı hata sayar', () => {
    const rows = validate('parent', [
      { ad: 'A', soyad: 'B', personelno: '33333333333' },
      { ad: 'C', soyad: 'D', personelno: '33333333333' },
    ]);
    expect(rows.map((r) => r.status)).toEqual(['ready', 'error']);
    expect(rows[1].issues[0].key).toBe('BULK_IMPORT.ISSUE_DUPLICATE_TC_IN_FILE');
  });

  it('TC yoksa her satırı yeni veli sayar (tekrar kontrolü yok)', () => {
    const rows = validate('parent', [
      { ad: 'A', soyad: 'B' },
      { ad: 'A', soyad: 'B' },
    ]);
    expect(rows.map((r) => r.status)).toEqual(['ready', 'ready']);
  });
});

describe('düzeltme dosyası', () => {
  it('şablon başlıkları, orijinal değerler ve hata sütunuyla satır üretir', () => {
    const rows = buildFixSheetRows('student', [
      {
        raw: { rowNo: 5, cells: { ad: 'Ali', soyad: 'Kaya', personelno: 12345678901, sicilno: '0012', dogumtarih: 45000, bolum: '9-Z' } },
        error: 'Sınıf / Şube listede yok',
      },
    ]);
    const header = rows[0];
    const value = (name: string) => rows[1][header.indexOf(name)];
    expect(header[0]).toBe('Ad *');
    expect(header).toContain('TC Kimlik No *');
    expect(header[header.length - 1]).toBe(ERROR_COLUMN_HEADER);
    expect(value('TC Kimlik No *')).toBe('12345678901');
    expect(value('Okul No')).toBe('0012');
    expect(value('Doğum Tarihi')).toBe('15.03.2023');
    expect(value('Sınıf / Şube')).toBe('9-Z');
    expect(value(ERROR_COLUMN_HEADER)).toBe('Sınıf / Şube listede yok');
  });

  it('yeniden yüklemede hata sütununu uyarı vermeden yok sayar', () => {
    const rows = buildFixSheetRows('student', [
      { raw: { rowNo: 2, cells: { ad: 'Ali', soyad: 'Kaya', personelno: '12345678901' } }, error: 'x' },
    ]);
    const parsed = parseSheetMatrix('student', rows);
    expect(parsed.unknownHeaders).toEqual([]);
    expect(parsed.missingRequired).toEqual([]);
    expect(parsed.rows[0].cells).toMatchObject({ ad: 'Ali', personelno: '12345678901' });
  });
});

describe('buildValidationContext', () => {
  it('öğrenci, veli ve ilişki yapılarını kurar', () => {
    const context = buildValidationContext(LOOKUPS, PERSONS, RELATIONS);
    expect(context.studentIds).toEqual(new Set([239, 240]));
    expect(context.existingStudentsByTc.get('44444444444')?.map((p) => p.id)).toEqual([239]);
    expect(context.existingParentIdsByTc.get('11111111111')).toBe(500);
    expect(context.relationKeys.has('239:500')).toBe(true);
  });
});
