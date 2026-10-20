import { describe, expect, it } from 'vitest';
import { ImportRow } from '../models/bulk-import.model';
import { groupReasons, matchesRowFilter, matchesSearch, reasonIdsOf } from './bulk-import-summary.utils';

function row(partial: Partial<ImportRow> & { rowNo: number }): ImportRow {
  return {
    ad: 'Ali',
    soyad: 'Kaya',
    key: '12345678901',
    payload: null,
    status: 'ready',
    issues: [],
    existingId: null,
    relationStudentIds: [],
    alreadyLinked: 0,
    ...partial,
  };
}

const LOOKUP = (field: string) => ({ key: 'BULK_IMPORT.ISSUE_LOOKUP_NOT_FOUND', params: { field, value: 'x' } });

describe('groupReasons', () => {
  it('sorunları tür ve alana göre gruplar, satırı grupta bir kez sayar', () => {
    const groups = groupReasons([
      row({ rowNo: 2, status: 'error', issues: [LOOKUP('Sınıf / Şube'), LOOKUP('Sınıf / Şube')] }),
      row({ rowNo: 3, status: 'error', issues: [LOOKUP('Sınıf / Şube'), LOOKUP('Kampüs')] }),
      row({ rowNo: 4, status: 'exists', issues: [{ key: 'BULK_IMPORT.ISSUE_EXISTS' }] }),
      row({ rowNo: 5, status: 'ready' }),
    ]);
    expect(groups.map((g) => [g.kind, g.field ?? g.issueKey, g.count])).toEqual([
      ['error', 'Sınıf / Şube', 2],
      ['error', 'Kampüs', 1],
      ['skipped', 'BULK_IMPORT.ISSUE_EXISTS', 1],
    ]);
  });

  it('yeni ilişki kurulacak mevcut veliyi atlanan saymaz', () => {
    const groups = groupReasons([
      row({
        rowNo: 2,
        status: 'exists',
        relationStudentIds: [239],
        issues: [{ key: 'BULK_IMPORT.ISSUE_EXISTS_PARENT_LINK', params: { count: 1 } }],
      }),
    ]);
    expect(groups).toEqual([]);
  });

  it('aktarım sonrası başarısız satırları sunucu mesajından bağımsız tek grupta toplar', () => {
    const failed = (rowNo: number, message: string) =>
      row({
        rowNo,
        outcome: 'failed',
        outcomeIssue: { key: 'BULK_IMPORT.ERR_SERVER', params: { message } },
      });
    const groups = groupReasons([failed(2, 'a'), failed(3, 'b')]);
    expect(groups).toEqual([
      expect.objectContaining({ kind: 'failed', issueKey: 'BULK_IMPORT.ERR_SERVER', count: 2 }),
    ]);
  });

  it('reasonIdsOf satırın grup ID\'lerini verir', () => {
    const r = row({ rowNo: 2, status: 'error', issues: [LOOKUP('Kampüs')] });
    const [group] = groupReasons([r]);
    expect(reasonIdsOf(r)).toEqual([group.id]);
    expect(reasonIdsOf(row({ rowNo: 3 }))).toEqual([]);
  });
});

describe('matchesRowFilter', () => {
  it('durum ve sonuç filtrelerini ayırır', () => {
    const added = row({ rowNo: 2, outcome: 'imported' });
    const updated = row({ rowNo: 3, status: 'update', outcome: 'imported' });
    expect(matchesRowFilter(added, 'imported')).toBe(true);
    expect(matchesRowFilter(updated, 'imported')).toBe(false);
    expect(matchesRowFilter(updated, 'updated')).toBe(true);
    expect(matchesRowFilter(updated, 'update')).toBe(true);
    expect(matchesRowFilter(added, 'all')).toBe(true);
    expect(matchesRowFilter(added, 'error')).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('ad, soyad, TC ve satır no içinde harf farkını yok sayarak arar', () => {
    const r = row({ rowNo: 17, ad: 'Ayşe', soyad: 'Işık' });
    expect(matchesSearch(r, 'ayse')).toBe(true);
    expect(matchesSearch(r, 'ISIK')).toBe(true);
    expect(matchesSearch(r, '345678')).toBe(true);
    expect(matchesSearch(r, '17')).toBe(true);
    expect(matchesSearch(r, 'mehmet')).toBe(false);
    expect(matchesSearch(r, '  ')).toBe(true);
  });
});
