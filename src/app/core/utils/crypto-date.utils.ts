export function getTodayKeyParts(sc = ''): { key: string; iv: string } {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yyyy = today.getFullYear().toString();

  const key = `${yyyy}${mm}${dd}${sc}`;
  const iv = `${yyyy}${mm}${dd}${mm}${yyyy}${dd}`;

  return { key, iv };
}
