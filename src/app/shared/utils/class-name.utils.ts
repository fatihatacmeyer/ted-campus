/**
 * Sınıf adı yardımcıları ("5/A", "10-B", "ANA", "LHZ/A").
 * Okul saatleri sıralaması ve tablo sınıf filtresi aynı ayrıştırmayı kullanır.
 */

export interface ParsedClassName {
  /** Sınıf seviyesi; sayıyla başlamayan adlarda (ANA, LHZ/A) null. */
  grade: number | null;
  /** Şube ("A"); seviye yoksa ya da şube belirtilmemişse boş. */
  section: string;
  /** Normalleştirilmiş ad: "5-A" → "5/A"; seviyesiz adlarda orijinal (trim edilmiş) ad. */
  name: string;
}

/** Seçim token'ları: tüm seviye → "5", tek şube → "5/A", seviyesiz sınıf → "ANA". */
export interface ClassGroup {
  grade: number | null;
  /** Seviye etiketi: "5" ya da seviyesiz sınıfın adı. */
  key: string;
  /** Şubeler (sıralı, tekrarsız). Seviyesiz gruplarda boş. */
  sections: string[];
}

const CLASS_PATTERN = /^(\d+)[-/\s]*(.*)$/;

export function parseClassName(raw: string): ParsedClassName {
  const text = (raw ?? '').trim();
  const match = text.match(CLASS_PATTERN);
  if (!match) return { grade: null, section: '', name: text };
  const grade = parseInt(match[1], 10);
  const section = match[2].trim().toLocaleUpperCase('tr');
  return { grade, section, name: section ? `${grade}/${section}` : String(grade) };
}

/** Sayısal seviye, sonra şube; seviyesizler sona, kendi aralarında alfabetik. */
export function compareClassNames(a: string, b: string): number {
  const pa = parseClassName(a);
  const pb = parseClassName(b);
  if (pa.grade !== null && pb.grade !== null) {
    if (pa.grade !== pb.grade) return pa.grade - pb.grade;
    return pa.section.localeCompare(pb.section, 'tr');
  }
  if (pa.grade !== null) return -1;
  if (pb.grade !== null) return 1;
  return a.localeCompare(b, 'tr', { numeric: true });
}

/**
 * Hücre metninden sınıf adlarını çıkarır.
 * "Ayşe Yılmaz (5/A), Ali Yılmaz (7/B)" → ["5/A", "7/B"]; parantez yoksa metnin kendisi tek sınıf adıdır.
 */
export function extractClassNames(text: string | null | undefined): string[] {
  const value = (text ?? '').trim();
  if (!value) return [];
  const inParens = [...value.matchAll(/\(([^()]*)\)/g)].map((m) => m[1].trim()).filter(Boolean);
  return inParens.length ? inParens : [value];
}

/** Sınıf adlarından seviye → şube ağacı üretir (filtre popup'ı için). */
export function buildClassGroups(names: Iterable<string>): ClassGroup[] {
  const grades = new Map<number, Set<string>>();
  const others = new Set<string>();
  for (const raw of names) {
    const p = parseClassName(raw);
    if (!p.name) continue;
    if (p.grade === null) {
      others.add(p.name);
    } else {
      const set = grades.get(p.grade) ?? new Set<string>();
      if (p.section) set.add(p.section);
      grades.set(p.grade, set);
    }
  }
  const groups: ClassGroup[] = [...grades.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, sections]) => ({
      grade,
      key: String(grade),
      sections: [...sections].sort((a, b) => a.localeCompare(b, 'tr')),
    }));
  for (const name of [...others].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))) {
    groups.push({ grade: null, key: name, sections: [] });
  }
  return groups;
}

/** Bir sınıf adının hangi token'larla eşleşebileceği: seviye token'ı ve tam ad token'ı. */
function matchesToken(raw: string, token: string): boolean {
  const p = parseClassName(raw);
  return p.name === token || (p.grade !== null && String(p.grade) === token);
}

/** Satırın sınıflarından en az biri seçilen token'lardan birine uyuyorsa true; seçim boşsa her şey geçer. */
export function matchesClassSelection(
  names: readonly string[],
  tokens: readonly string[] | null | undefined,
): boolean {
  if (!tokens || tokens.length === 0) return true;
  return names.some((n) => tokens.some((t) => matchesToken(n, t)));
}
