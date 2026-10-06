import '@angular/compiler';
import { Injector } from '@angular/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { describe, expect, it } from 'vitest';
import { ImportEvent, ImportRow } from '../models/bulk-import.model';
import { BulkImportService } from './bulk-import.service';
import { PersonService } from './person.service';
import { TypesService } from './types.service';

interface FakeOptions {
  /** Hangi satır adı (ad) eklenemesin. */
  failInsertFor?: string[];
  /** "ogrenciId:veliId" çiftleri sunucuda sessizce oluşmasın. */
  dropPairs?: string[];
  initialRelations?: { VeliSicilId: number; OgrenciSicilId: number }[];
}

function setup(options: FakeOptions = {}) {
  let nextId = 1000;
  const relations = [...(options.initialRelations ?? [])];
  const added: string[] = [];

  const fakePerson = {
    insertPerson: (payload: { ad: string }) =>
      options.failInsertFor?.includes(payload.ad)
        ? of([{ islemsonuc: '2', sunucucevap: 'hata', id: 0 }])
        : of([{ islemsonuc: '1', id: nextId++ }]),
    getAllRelations: () => of([...relations]),
    addRelationCampus: (studentId: number, parentId: number) => {
      const key = `${studentId}:${parentId}`;
      added.push(key);
      if (!options.dropPairs?.includes(key)) {
        relations.push({ VeliSicilId: parentId, OgrenciSicilId: studentId });
      }
      return of(null);
    },
  };

  const injector = Injector.create({
    providers: [
      { provide: PersonService, useValue: fakePerson },
      { provide: TypesService, useValue: {} },
      { provide: BulkImportService, useClass: BulkImportService, deps: [] },
    ],
  });
  return { service: injector.get(BulkImportService), added, relations };
}

function row(partial: Partial<ImportRow> & { rowNo: number; ad: string }): ImportRow {
  return {
    soyad: 'Test',
    key: '',
    payload: { ad: partial.ad, soyad: 'Test', userdef: 12 },
    status: 'ready',
    issues: [],
    existingId: null,
    relationStudentIds: [],
    alreadyLinked: 0,
    ...partial,
  };
}

async function run(service: BulkImportService, kind: 'student' | 'parent', rows: ImportRow[]) {
  return lastValueFrom(service.importRows(kind, rows).pipe(toArray()));
}

const results = (events: ImportEvent[]) =>
  events.filter((e) => e.type === 'relationResult') as Extract<ImportEvent, { type: 'relationResult' }>[];

describe('BulkImportService.importRows', () => {
  it('önce velileri ekler, sonra ilişkileri kurar ve doğrular', async () => {
    const { service, added } = setup();
    const events = await run(service, 'parent', [
      row({ rowNo: 2, ad: 'Ayşe', relationStudentIds: [239, 240] }),
      row({ rowNo: 3, ad: 'Mehmet', relationStudentIds: [240] }),
    ]);

    const types = events.map((e) => e.type);
    const lastRecord = types.lastIndexOf('record');
    expect(types.indexOf('relationsStart')).toBeGreaterThan(lastRecord);
    expect(events.find((e) => e.type === 'relationsStart')).toEqual({
      type: 'relationsStart',
      total: 3,
    });
    expect(added.sort()).toEqual(['239:1000', '240:1000', '240:1001'].sort());
    expect(results(events).every((r) => r.ok)).toBe(true);
    expect(results(events)).toHaveLength(3);
  });

  it('mevcut velinin yeni ilişkisini kurar, veliyi tekrar eklemez', async () => {
    const { service, added } = setup();
    const events = await run(service, 'parent', [
      row({
        rowNo: 2,
        ad: 'Mevcut',
        status: 'exists',
        payload: null,
        existingId: 500,
        relationStudentIds: [240],
      }),
    ]);
    expect(events.filter((e) => e.type === 'record')).toHaveLength(0);
    expect(added).toEqual(['240:500']);
    expect(results(events)).toEqual([
      { type: 'relationResult', rowNo: 2, studentId: 240, ok: true },
    ]);
  });

  it('eklenemeyen velinin ilişkilerini denemez', async () => {
    const { service, added } = setup({ failInsertFor: ['Hatalı'] });
    const events = await run(service, 'parent', [
      row({ rowNo: 2, ad: 'Hatalı', relationStudentIds: [239] }),
      row({ rowNo: 3, ad: 'Sağlam', relationStudentIds: [240] }),
    ]);
    const records = events.filter((e) => e.type === 'record') as Extract<ImportEvent, { type: 'record' }>[];
    expect(records.find((r) => r.outcome.rowNo === 2)?.outcome.ok).toBe(false);
    expect(added).toEqual(['240:1000']);
    expect(results(events).map((r) => r.rowNo)).toEqual([3]);
  });

  it('sunucuda oluşmayan ilişkiyi başarısız raporlar', async () => {
    const { service } = setup({ dropPairs: ['240:1000'] });
    const events = await run(service, 'parent', [
      row({ rowNo: 2, ad: 'Ayşe', relationStudentIds: [239, 240] }),
    ]);
    expect(results(events).map((r) => [r.studentId, r.ok])).toEqual([
      [239, true],
      [240, false],
    ]);
  });

  it('zaten var olan çifti tekrar eklemeden başarılı sayar', async () => {
    const { service, added } = setup({
      initialRelations: [{ VeliSicilId: 1000, OgrenciSicilId: 239 }],
    });
    const events = await run(service, 'parent', [
      row({ rowNo: 2, ad: 'Ayşe', relationStudentIds: [239] }),
    ]);
    // Yeni veli 1000 ID'sini alır; 239:1000 zaten ilişkili olduğundan eklenmez.
    expect(added).toEqual([]);
    expect(results(events)).toEqual([
      { type: 'relationResult', rowNo: 2, studentId: 239, ok: true },
    ]);
  });

  it('öğrenci aktarımında ilişki aşaması çalışmaz', async () => {
    const { service, added } = setup();
    const events = await run(service, 'student', [row({ rowNo: 2, ad: 'Öğrenci' })]);
    expect(events.map((e) => e.type)).toEqual(['record']);
    expect(added).toEqual([]);
  });

  it('istek hatasını satır hatası olarak yayımlar', async () => {
    const { service } = setup();
    const failing = {
      insertPerson: () => throwError(() => new Error('ağ')),
      getAllRelations: () => of([]),
      addRelationCampus: () => of(null),
    };
    const injector = Injector.create({
      providers: [
        { provide: PersonService, useValue: failing },
        { provide: TypesService, useValue: {} },
        { provide: BulkImportService, useClass: BulkImportService, deps: [] },
      ],
    });
    const events = await run(injector.get(BulkImportService), 'student', [row({ rowNo: 2, ad: 'X' })]);
    expect(events).toEqual([{ type: 'record', outcome: { rowNo: 2, ok: false } }]);
    expect(service).toBeTruthy();
  });
});
