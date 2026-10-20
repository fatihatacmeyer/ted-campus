/**
 * "Bilgileri Gönder" (sp_loginsendcampus_d) yardımcıları.
 *
 * Prosedür @xsicilid olarak tek Id ('5') ya da ';' ile ayrılmış liste ('5;6;7') alır,
 * hepsini tek işlemde siler ve (Sonuc, SunucuCevap) döner. Alan adlarının büyük/küçük
 * harfi prosedür sürümleri arasında değişebildiği için yanıt harf duyarsız okunur.
 */

/** Tek seferde gönderilebilecek en fazla kişi: prosedür tüm listeyi tek transaction'da siler. */
export const LOGIN_SEND_MAX = 200;

export interface LoginSendResult {
  sonuc: number;
  /** Sunucunun mesajı; yanıt yoksa boş. */
  sunucuCevap: string;
}

/** Geçerli (pozitif tam sayı) Id'leri tekrarsız olarak '5;6;7' biçimine çevirir. */
export function toSicilIdList(ids: readonly number[]): string {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].join(';');
}

/** Prosedür yanıtını (dizi ya da tekil satır) harf duyarsız okur. */
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

/** Onay metni için ilk `max` adı ve kalan sayısını döner. */
export function summarizeNames(
  names: readonly string[],
  max = 5,
): { shown: string; rest: number } {
  return { shown: names.slice(0, max).join(', '), rest: Math.max(0, names.length - max) };
}
