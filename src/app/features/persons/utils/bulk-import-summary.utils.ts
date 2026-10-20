import { ImportRow, RowIssue } from '../models/bulk-import.model';
import { normalizeKey } from './bulk-import.utils';

/** Özet kutucuklarıyla seçilen tablo filtresi. */
export type RowFilter =
  | 'all'
  | 'ready'
  | 'update'
  | 'exists'
  | 'error'
  | 'imported'
  | 'updated'
  | 'partial'
  | 'failed';

/** Neden grubunun ait olduğu bölüm: düzeltilmesi gereken, atlanan, aktarımda başarısız olan. */
export type ReasonKind = 'error' | 'skipped' | 'failed';

/** Aynı sorun türüne (ve varsa aynı alana) sahip satırların sayımı. */
export interface ReasonGroup {
  id: string;
  kind: ReasonKind;
  /** Sorunun i18n anahtarı (örn. 'BULK_IMPORT.ISSUE_LOOKUP_NOT_FOUND'). */
  issueKey: string;
  /** Sorun bir alana özgüyse alanın Excel başlığı (örn. 'Sınıf / Şube'). */
  field?: string;
  count: number;
}

const KIND_ORDER: ReasonKind[] = ['error', 'skipped', 'failed'];

/** Satırın hangi bölümde, hangi sorunlarla raporlanacağı; sorunsuz satırlar için null. */
function reasonSource(row: ImportRow): { kind: ReasonKind; issues: RowIssue[] } | null {
  if ((row.outcome === 'failed' || row.outcome === 'partial') && row.outcomeIssue) {
    return { kind: 'failed', issues: [row.outcomeIssue] };
  }
  if (row.status === 'error') return { kind: 'error', issues: row.issues };
  // Yeni ilişki kurulacak mevcut veli iş içerir; atlanan sayılmaz.
  if (row.status === 'exists' && row.relationStudentIds.length === 0) {
    return { kind: 'skipped', issues: row.issues };
  }
  return null;
}

function fieldOf(issue: RowIssue): string | undefined {
  const field = issue.params?.['field'];
  return field === undefined || field === '' ? undefined : String(field);
}

function reasonId(kind: ReasonKind, issue: RowIssue): string {
  return `${kind}|${issue.key}|${fieldOf(issue) ?? ''}`;
}

/** Satırın dahil olduğu neden gruplarının ID'leri. */
export function reasonIdsOf(row: ImportRow): string[] {
  const source = reasonSource(row);
  if (!source) return [];
  return [...new Set(source.issues.map((issue) => reasonId(source.kind, issue)))];
}

/**
 * Sorunlu satırları sorun türüne göre gruplar. Bir satırın birden fazla sorunu varsa her grupta
 * bir kez sayılır. Sıralama: bölüm (hatalı → atlanan → başarısız), sonra satır sayısı (çoktan aza).
 */
export function groupReasons(rows: ImportRow[]): ReasonGroup[] {
  const groups = new Map<string, ReasonGroup>();
  for (const row of rows) {
    const source = reasonSource(row);
    if (!source) continue;
    const seen = new Set<string>();
    for (const issue of source.issues) {
      const id = reasonId(source.kind, issue);
      if (seen.has(id)) continue;
      seen.add(id);
      const group = groups.get(id);
      if (group) group.count++;
      else groups.set(id, { id, kind: source.kind, issueKey: issue.key, field: fieldOf(issue), count: 1 });
    }
  }
  return [...groups.values()].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.count - a.count,
  );
}

/** Özet kutucuğu filtresine uyuyor mu? */
export function matchesRowFilter(row: ImportRow, filter: RowFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'imported':
      return row.outcome === 'imported' && row.status !== 'update';
    case 'updated':
      return row.outcome === 'imported' && row.status === 'update';
    case 'partial':
    case 'failed':
      return row.outcome === filter;
    default:
      return row.status === filter;
  }
}

/** Ad, soyad, TC veya satır numarasında arar (büyük/küçük harf ve Türkçe karakter farkı yok sayılır). */
export function matchesSearch(row: ImportRow, term: string): boolean {
  const needle = normalizeKey(term);
  if (!needle) return true;
  return normalizeKey(`${row.ad} ${row.soyad} ${row.key} ${row.rowNo}`).includes(needle);
}
