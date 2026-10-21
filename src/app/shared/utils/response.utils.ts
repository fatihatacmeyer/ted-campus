export function unwrapResponse<T>(response: T | T[] | null | undefined): T | null {
  if (Array.isArray(response)) {
    return response.length > 0 ? (response[0] as T) : null;
  }
  return response ?? null;
}

export function isSuccessResult(
  result: { islemsonuc?: string | number } | null | undefined,
): boolean {
  return result?.islemsonuc === '1' || result?.islemsonuc === 1;
}

export function extractNewId(result: { id?: number } | null | undefined): number | null {
  const id = Number(result?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}
