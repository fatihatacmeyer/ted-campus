/**
 * Tarihi YYYY-MM-DD formatına çevirir.
 * - string ise aynen döner (zaten formatlı geldiği varsayılır)
 * - Date ise LOCAL saat diliminden (getFullYear/getMonth/getDate) formatlar
 *   — toISOString() UTC'ye çevirdiği için Türkiye saatiyle gece yarısına yakın
 *   Date'lerde bir gün kaymasına yol açar, o yüzden KULLANILMAZ.
 * - null/undefined ise '' döner.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Backend'den gelen 'YYYY-MM-DD' string'ini Date objesine çevirir.
 * - Yerel saat dilimine göre parse eder (new Date('YYYY-MM-DD') UTC parse eder,
 *   bu yüzden split ile parçalara ayırıp yerel kurar).
 * - Date ise kopyasını döner (yeni Date nesnesi).
 * - boş/geçersiz/eksik format → null döner.
 */
// YENİ HALİ
export function parseDate(dateStr: Date | string | null | undefined): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return new Date(dateStr);
  const [datePart, timePart] = dateStr.split(/[T ]/);
  const dateParts = datePart.split('-');
  if (dateParts.length !== 3) return null;
  const [year, month, day] = dateParts.map(Number);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (timePart) {
    const timeParts = timePart.split(':').map(Number);
    hours = timeParts[0] || 0;
    minutes = timeParts[1] || 0;
    seconds = timeParts[2] || 0;
  }

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/** PDKS dönem seçimi: gün / hafta / ay */
export type PeriodType = 'gun' | 'hafta' | 'ay';

/**
 * Dönem tipine göre kapsayıcı [başlangıç, bitiş] tarih aralığını hesaplar.
 * - 'gun'   -> verilen tarihin kendisi
 * - 'hafta' -> içinde bulunduğu haftanın Pazartesi–Pazar günleri
 * - 'ay'    -> ayın 1. günü ile son günü
 * Dönüş formatı: yyyy-MM-dd (backend kabulü, kapsayıcı aralık).
 */
export function computePeriodRange(
  period: PeriodType,
  date: Date = new Date(),
): { baslangic: string; bitis: string } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let start: Date;
  let end: Date;
  switch (period) {
    case 'gun':
      start = d;
      end = d;
      break;
    case 'hafta': {
      const day = d.getDay(); // 0=Pazar, 1=Pazartesi ...
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      break;
    }
    case 'ay':
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      break;
  }
  return { baslangic: formatDate(start), bitis: formatDate(end) };
}

/**
 * 'yyyy-MM-ddTHH:mm:ss' (veya 'yyyy-MM-dd HH:mm:ss') formatındaki zaman
 * damgasından saat kısmını 'HH:mm' olarak döndürür; parse edilemezse '' döner.
 */
export function formatTime(datetime: string | null | undefined): string {
  if (!datetime) return '';
  const match = datetime.match(/T(\d{2}:\d{2})|(\d{2}:\d{2})/);
  return match ? (match[1] ?? match[2]) : '';
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
