import * as XLSX from 'xlsx';

/**
 * Satırları .xlsx dosyası olarak indirir (SheetJS).
 * Sütun genişlikleri içeriğe göre otomatik hesaplanır.
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map((header, i) => {
    const maxLen = Math.max(
      header.length,
      ...rows.map((row) => String(row[i] ?? '').length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 60) };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Liste');
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
