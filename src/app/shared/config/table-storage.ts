/** Tablo filtrelerinin sessionStorage anahtar öneki (tableId eklenir) */
export const TABLE_FILTER_STORAGE_PREFIX = 'ted_table_filters_';

/** Tüm tablo filtrelerini siler — çıkışta çağrılır */
export function clearAllTableFilters(): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(TABLE_FILTER_STORAGE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* depolama erişilemiyorsa yok say */
  }
}
