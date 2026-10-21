import { ImportRow, RowIssue } from '../models/bulk-import.model';
import { normalizeKey } from './bulk-import.utils';

export type RowFilter =
  'all' | 'ready' | 'update' | 'exists' | 'error' | 'imported' | 'updated' | 'partial' | 'failed';

export type ReasonKind = 'error' | 'skipped' | 'failed';

export interface ReasonGroup {
  id: string;
  kind: ReasonKind;
  issueKey: string;
  field?: string;
  count: number;
}

const KIND_ORDER: ReasonKind[] = ['error', 'skipped', 'failed'];

function reasonSource(row: ImportRow): { kind: ReasonKind; issues: RowIssue[] } | null {
  if ((row.outcome === 'failed' || row.outcome === 'partial') && row.outcomeIssue) {
    return { kind: 'failed', issues: [row.outcomeIssue] };
  }
  if (row.status === 'error') return { kind: 'error', issues: row.issues };
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

export function reasonIdsOf(row: ImportRow): string[] {
  const source = reasonSource(row);
  if (!source) return [];
  return [...new Set(source.issues.map((issue) => reasonId(source.kind, issue)))];
}

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
      else
        groups.set(id, {
          id,
          kind: source.kind,
          issueKey: issue.key,
          field: fieldOf(issue),
          count: 1,
        });
    }
  }
  return [...groups.values()].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.count - a.count,
  );
}

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

export function matchesSearch(row: ImportRow, term: string): boolean {
  const needle = normalizeKey(term);
  if (!needle) return true;
  return normalizeKey(`${row.ad} ${row.soyad} ${row.key} ${row.rowNo}`).includes(needle);
}
