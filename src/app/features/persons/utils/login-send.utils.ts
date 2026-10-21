export const LOGIN_SEND_MAX = 200;

export interface LoginSendResult {
  sonuc: number;
  sunucuCevap: string;
}

export function toSicilIdList(ids: readonly number[]): string {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].join(';');
}

export function parseLoginSendResponse(response: unknown): LoginSendResult {
  const row = (Array.isArray(response) ? response[0] : response) as
    | Record<string, unknown>
    | null
    | undefined;
  if (!row || typeof row !== 'object') return { sonuc: -1, sunucuCevap: '' };

  const pick = (name: string): unknown => {
    const key = Object.keys(row).find((k) => k.toLowerCase() === name);
    return key ? row[key] : undefined;
  };
  const sonuc = Number(pick('sonuc'));
  return {
    sonuc: Number.isFinite(sonuc) ? sonuc : -1,
    sunucuCevap: String(pick('sunucucevap') ?? ''),
  };
}

export function summarizeNames(
  names: readonly string[],
  max = 5,
): { shown: string; rest: number } {
  return { shown: names.slice(0, max).join(', '), rest: Math.max(0, names.length - max) };
}
