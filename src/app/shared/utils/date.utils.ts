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
export function parseDate(dateStr: Date | string | null | undefined): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return new Date(dateStr);
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return null;
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
}
