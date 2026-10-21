export const toLowerTr = (value: string | null | undefined): string =>
  (value ?? '').toLocaleLowerCase('tr-TR');

export const filterPeople = <T extends { fullName: string; className: string; schoolName: string }>(
  list: T[],
  term: string,
): T[] => {
  const q = toLowerTr(term.trim());
  if (!q) return list;
  return list.filter(
    (p) =>
      toLowerTr(p.fullName).includes(q) ||
      toLowerTr(p.className).includes(q) ||
      toLowerTr(p.schoolName).includes(q),
  );
};

export const uniqueSorted = (values: (string | null)[]): string[] =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, 'tr-TR', { numeric: true }),
  );
