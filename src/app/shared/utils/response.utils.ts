/**
 * Backend yanıtlarını normalize eden ortak yardımcı fonksiyonlar.
 *
 * Legacy backend (/Dynamic, /Person, /TA) bazı uç noktalarda dizi, bazılarında
 * tekil nesne döner. Bu helper'lar o farkı bileşen bazında tekrar tekrar
 * elle yazmak yerine tek noktada çözer.
 */

/**
 * Dizi olarak gelen backend yanıtını tekil nesneye indirger.
 * Dizi boşsa `null` döner; tekil nesne ise olduğu gibi iletilir.
 */
export function unwrapResponse<T>(response: T | T[] | null | undefined): T | null {
  if (Array.isArray(response)) {
    return response.length > 0 ? (response[0] as T) : null;
  }
  return response ?? null;
}

/**
 * Backend başarı kodunu kontrol eder.
 * Legacy backend bazen `islemsonuc == '1'` (string), bazen `== 1` (number) döner.
 */
export function isSuccessResult(
  result: { islemsonuc?: string | number } | null | undefined,
): boolean {
  return result?.islemsonuc === '1' || result?.islemsonuc === 1;
}
