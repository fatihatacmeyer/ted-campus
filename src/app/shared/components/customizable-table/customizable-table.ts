import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  Directive,
  EventEmitter,
  HostBinding,
  HostListener,
  inject,
  input,
  Input,
  OnInit,
  Output,
  QueryList,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableColResizeEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatDate } from '../../utils/date.utils';
import { exportToExcel } from '../../utils/table-export.utils';

/** Select filtre seçenekleri */
export interface FilterOption {
  label: string;
  value: unknown;
}

export interface ColumnDef<T = unknown> {
  field: string; // veri alanı adı
  header: string; // başlık
  headerTooltip?: string;
  sortable?: boolean;
  width?: string; // css genişliği (örn '70px')
  alwaysVisible?: boolean; // panelden kaldırılamaz
  filterType?: 'text' | 'select'; // filtre widget türü (varsayılan 'text')
  filterOptions?: FilterOption[] | ((rows: T[]) => FilterOption[]); // select seçenekleri (statik veya satırlardan türetilen)
  exportValue?: (row: T) => string | number | null; // dışa aktarma için özel değer (hücre görünümünden bağımsız)
  filterable?: boolean;
}

/** Sütun filtreleri için satırlardan benzersiz değer listesi üretir (null/boş hariç) */
export function uniqueFilterOptions<T extends object, K extends keyof T>(
  rows: T[],
  field: K,
): FilterOption[] {
  const seen = new Set<unknown>();
  const options: FilterOption[] = [];
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined || value === '') continue;
    if (!seen.has(value)) {
      seen.add(value);
      options.push({ label: String(value), value });
    }
  }
  return options.sort((a, b) => String(a.label).localeCompare(String(b.label), 'tr'));
}

@Directive({ selector: 'ng-template[appColumnCell]', standalone: true })
export class ColumnCellDirective {
  @Input('appColumnCell') field = '';
  constructor(public templateRef: TemplateRef<unknown>) {}
}

@Component({
  selector: 'app-customizable-table',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    FormsModule,
    InputTextModule,
    FloatLabelModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ButtonModule,
    SelectModule,
    CheckboxModule,
    TranslatePipe,
  ],
  templateUrl: './customizable-table.html',
  styleUrl: './customizable-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomizableTableComponent<T extends object = Record<string, unknown>>
  implements OnInit, AfterContentInit
{
  @Input() rows: T[] = [];
  @Input() columns: ColumnDef<T>[] = [];
  @Input() loading = false;
  @Input() tableId = 'default'; // localStorage anahtarı: ted_table_columns_${tableId}
  @Input() defaultFields: string[] | null = null; // null ise tüm sütunlar varsayılan
  @Input() emptyMessage = 'COMMON.NO_RECORDS';
  @Input() emptyCellValue = '-'; // boş hücre (null/undefined) görünümü
  @Input() showSearch = true;
  @Input() searchPlaceholder = 'COMMON.SEARCH';
  @Input() rowClickable = false;
  @Input() actionsTemplate: TemplateRef<{ $implicit: T }> | null = null; // her satırın sonundaki sabit İşlemler sütunu
  @Input() exportable = true; // Dışa Aktar (Excel/CSV) butonu
  @Input() exportFilename = ''; // varsayılan: tablo_${tableId}
  /** Tablonun başına görünür satır numarası sütunu ekler */
  @Input() showRowNumbers = false;
  @Input() rowNumberHeader = '#'; // satır numarası sütun başlığı
  /** Satır seçim modu — null ise seçim kapalı, 'multiple' çoklu seçim (checkbox) sağlar */
  @Input() selectionMode: 'single' | 'multiple' | null = null;
  /** Seçili satırlar (parent bileşen tutar) */
  @Input() selectedRows: T[] = [];
  /** Seçim değiştiğinde parent'a yeni seçim listesini bildirir */

  @Input() displayMode: 'paginated' | 'scroll' = 'paginated';
  @Input() scrollHeight = 'calc(100vh - 280px)';

  @HostBinding('class.mode-paginated')
  get isPaginated(): boolean {
    return this.displayMode === 'paginated';
  }

  @Output() selectedRowsChange = new EventEmitter<T[]>();
  @Output() rowClick = new EventEmitter<T>();

  @ContentChildren(ColumnCellDirective) cellDirectives!: QueryList<ColumnCellDirective>;

  selectedColumnFields: string[] = [];

  showColumnPanel = false;
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;

  filterText = '';

  /** Kullanıcının seçtiği sayfa boyutu — localStorage'da saklanır */
  rowsPerPage = 10;

  @ViewChild('dt', { static: false }) dt!: Table;

  /** Başlık filtresi popup'ı — açık sütun ve ekran koordinatları (fixed konumlu) */
  filterPopup: { col: ColumnDef<T>; x: number; y: number } | null = null;

  /** Sütun bazlı aktif filtreler (field → değer) — localStorage'da saklanır */
  private columnFilters = new Map<string, unknown>();

  /** Geçerli sayfanın ilk satır indeksi — satır numarası hesabı için */
  private currentFirst = 0;

  private destroyRef = inject(DestroyRef);
  private translateService = inject(TranslateService);

  private cellTemplateMap = new Map<string, TemplateRef<unknown>>();

  private cachedVisibleColumns: ColumnDef<T>[] = [];

  /** Kullanıcının yeniden boyutlandırdığı sütun genişlikleri (field → css değeri) */
  private columnWidths = new Map<string, string>();

  private get storageKey(): string {
    return `ted_table_columns_${this.tableId}`;
  }

  /** alwaysVisible işaretli sütunların field'ları */
  private get alwaysVisibleFields(): string[] {
    return this.columns.filter((col) => col.alwaysVisible).map((col) => col.field);
  }

  /** Varsayılan sütun listesi — defaultFields verilmediyse tüm sütunlar varsayılan */
  private get defaultColumnFields(): string[] {
    return this.defaultFields ?? this.columns.map((col) => col.field);
  }

  private get allColumnFields(): string[] {
    return this.columns.map((col) => col.field);
  }

  ngOnInit(): void {
    this.loadPageSize();
    this.loadColumnWidths();
    this.loadColumnFilters();
    this.selectedColumnFields = this.loadFromStorage();
    this.refreshVisibleColumns();
  }

  ngAfterViewInit(): void {
    // localStorage'dan geri yüklenen filtreleri tabloya uygula
    for (const [field, value] of this.columnFilters) {
      const col = this.columns.find((c) => c.field === field);
      if (col) {
        this.dt?.filter(value, field, col.filterType === 'select' ? 'equals' : 'contains');
      }
    }
    // Filtre popup'ı açıkken herhangi bir kaydırma (sayfa veya tablo içi) popup'ı kapatır
    const onScroll = (): void => {
      if (this.filterPopup) {
        this.filterPopup = null;
      }
    };
    document.addEventListener('scroll', onScroll, true);
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, true));
  }

  ngAfterContentInit(): void {
    this.rebuildCellTemplateMap();
    this.cellDirectives.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.rebuildCellTemplateMap();
    });
  }

  private rebuildCellTemplateMap(): void {
    this.cellTemplateMap.clear();
    for (const cell of this.cellDirectives) {
      this.cellTemplateMap.set(cell.field, cell.templateRef);
    }
  }

  get globalFilterFields(): string[] {
    return this.allColumnFields;
  }

  get visibleColumns(): ColumnDef<T>[] {
    return this.cachedVisibleColumns;
  }

  get hiddenColumns(): string[] {
    return this.allColumnFields.filter((field) => !this.selectedColumnFields.includes(field));
  }

  /** Seçim kaynağı — filtre uygulanmış satırlar, yoksa tüm satırlar */
  private selectionSource(): T[] {
    return (this.dt?.filteredValue?.length ? (this.dt.filteredValue as T[]) : this.rows) ?? [];
  }

  /** Satır seçili mi? (referans karşılaştırması) */
  isRowSelected(row: T): boolean {
    return this.selectedRows.includes(row);
  }

  /** Tek bir satırın seçimini değiştirir */
  onRowSelectionChange(row: T, checked: boolean): void {
    let next: T[];
    if (checked) {
      next = this.selectionMode === 'single' ? [row] : [...this.selectedRows, row];
    } else {
      next = this.selectedRows.filter((r) => r !== row);
    }
    this.selectedRowsChange.emit(next);
  }

  /** Filtrelenmiş satırların tamamı seçili mi? */
  isAllRowsSelected(): boolean {
    const source = this.selectionSource();
    return source.length > 0 && source.every((r) => this.selectedRows.includes(r));
  }

  /** Tüm (filtrelenmiş) satırları seçer / seçimi kaldırır */
  toggleAllRows(): void {
    const source = this.selectionSource();
    const selectAll = !this.isAllRowsSelected();
    let next = [...this.selectedRows];
    if (selectAll) {
      for (const r of source) {
        if (!next.includes(r)) next.push(r);
      }
    } else {
      next = next.filter((r) => !source.includes(r));
    }
    this.selectedRowsChange.emit(next);
  }

  getColHeader(field: string): string {
    return this.columns.find((col) => col.field === field)?.header ?? field;
  }

  /** Sütun seçici panelde gösterilecek uzun ismi döner */
  getColDisplayName(field: string): string {
    const col = this.columns.find((c) => c.field === field);
    return col ? (col.headerTooltip ?? col.header) : field;
  }

  isAlwaysVisible(field: string): boolean {
    return this.alwaysVisibleFields.includes(field);
  }

  toggleColumn(field: string): void {
    const idx = this.selectedColumnFields.indexOf(field);
    if (idx >= 0) {
      if (this.isAlwaysVisible(field)) return;
      this.selectedColumnFields.splice(idx, 1);
    } else {
      this.selectedColumnFields.push(field);
    }
    this.refreshVisibleColumns();
    this.saveToStorage();
  }

  onDragStart(event: DragEvent, index: number): void {
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverIndex = index;
  }

  onDragLeave(): void {
    this.dragOverIndex = null;
  }

  onDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (this.draggedIndex === null || this.draggedIndex === targetIndex) {
      this.dragOverIndex = null;
      return;
    }
    const item = this.selectedColumnFields.splice(this.draggedIndex, 1)[0];
    this.selectedColumnFields.splice(targetIndex, 0, item);
    this.draggedIndex = null;
    this.dragOverIndex = null;
    this.refreshVisibleColumns();
    this.saveToStorage();
  }

  onDragEnd(): void {
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showColumnPanel && this.draggedIndex === null) {
      const target = event.target as HTMLElement;
      if (!target.closest('.col-selector-wrapper')) {
        this.showColumnPanel = false;
      }
    }
  }

  /** Varsayılan sütunlara dön */
  onClearColumns(): void {
    this.selectedColumnFields = [...this.defaultColumnFields];
    this.refreshVisibleColumns();
    this.saveToStorage();
  }

  /* ── Sütun Filtreleri ──────────────────────────────────── */

  /** Sütunun filtre widget türü — select seçenek tanımlıysa açılır menü, değilse arama kutusu */
  getColumnFilterType(col: ColumnDef<T>): 'text' | 'select' {
    return col.filterType === 'select' || col.filterOptions !== undefined ? 'select' : 'text';
  }

  /** En az bir aktif filtre varsa toolbar'da temizle butonu görünür */
  get hasActiveFilters(): boolean {
    return this.columnFilters.size > 0;
  }

  /** Popup'ı açılan sütunun tanımı */
  getActiveFilterColumn(): ColumnDef<T> | null {
    return this.filterPopup?.col ?? null;
  }

  /** Sütunda aktif filtre değeri varsa buton vurgulanır */
  hasFilterOn(field: string): boolean {
    return this.columnFilters.has(field);
  }

  /** Başlıktaki filtre butonu — popup'ı butonun altında açar (viewport içinde kalır) */
  onFilterBtnClick(event: MouseEvent, col: ColumnDef<T>): void {
    event.stopPropagation();
    if (this.filterPopup?.col.field === col.field) {
      this.filterPopup = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const popupWidth = 220;
    const popupHeight = 140;
    let x = rect.left;
    let y = rect.bottom + 4;
    if (x + popupWidth > window.innerWidth) {
      x = Math.max(8, window.innerWidth - popupWidth - 8);
    }
    if (y + popupHeight > window.innerHeight) {
      y = Math.max(8, rect.top - popupHeight - 4);
    }
    this.filterPopup = { col, x, y };
  }

  /** Popup'ı kapatır (× butonu, Escape, dışarı tıklama, kaydırma) */
  closeFilterPopup(): void {
    this.filterPopup = null;
  }

  /** Tek sütunun filtresini temizler (popup açık kalır) */
  clearColumnFilter(col: ColumnDef<T>): void {
    this.columnFilters.delete(col.field);
    this.dt?.filter(
      null,
      col.field,
      this.getColumnFilterType(col) === 'select' ? 'equals' : 'contains',
    );
    this.saveColumnFilters();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClickFilter(event: MouseEvent): void {
    if (!this.filterPopup) return;
    const target = event.target as HTMLElement | null;
    // Popup içi, filtre butonları ve select açılır listesi dışındaki tıklamalar popup'ı kapatır
    if (target?.closest('.col-filter-popup, .col-filter-btn, .p-select-overlay')) return;
    this.filterPopup = null;
  }

  @HostListener('window:resize', [])
  onFilterViewportChange(): void {
    if (this.filterPopup) {
      this.filterPopup = null;
    }
  }

  @HostListener('window:keydown.escape', [])
  onFilterEscape(): void {
    this.filterPopup = null;
  }

  /** Select seçenekleri — statik dizi veya satırlardan türetilen fonksiyon */
  getFilterOptions(col: ColumnDef<T>): FilterOption[] {
    const opts =
      typeof col.filterOptions === 'function' ? col.filterOptions(this.rows) : col.filterOptions;
    return opts ?? [];
  }

  getColumnFilterValue(field: string): unknown {
    return this.columnFilters.get(field) ?? null;
  }

  /** Filtre değiştiğinde PrimeNG tablosuna uygular ve kalıcı hale getirir */
  onColumnFilterChange(col: ColumnDef<T>, value: unknown): void {
    const matchMode = this.getColumnFilterType(col) === 'select' ? 'equals' : 'contains';
    if (value === null || value === undefined || value === '') {
      this.columnFilters.delete(col.field);
      this.dt?.filter(null, col.field, matchMode);
    } else {
      this.columnFilters.set(col.field, value);
      this.dt?.filter(value, col.field, matchMode);
    }
    this.saveColumnFilters();
  }

  /** Tüm sütun filtrelerini temizler (global aramaya dokunmaz) */
  clearColumnFilters(): void {
    for (const col of this.columns) {
      this.columnFilters.delete(col.field);
      this.dt?.filter(
        null,
        col.field,
        this.getColumnFilterType(col) === 'select' ? 'equals' : 'contains',
      );
    }
    this.saveColumnFilters();
  }

  private get filterStorageKey(): string {
    return `ted_table_filters_${this.tableId}`;
  }

  private loadColumnFilters(): void {
    try {
      const raw = localStorage.getItem(this.filterStorageKey);
      if (raw) {
        const parsed: Record<string, unknown> = JSON.parse(raw);
        for (const col of this.columns) {
          const value = parsed[col.field];
          if (value !== undefined && value !== null && value !== '') {
            this.columnFilters.set(col.field, value);
          }
        }
      }
    } catch {
      /* bozuk veri yok sayılır */
    }
  }

  private saveColumnFilters(): void {
    try {
      localStorage.setItem(
        this.filterStorageKey,
        JSON.stringify(Object.fromEntries(this.columnFilters)),
      );
    } catch {
      /* localStorage doluysa sessizce geç */
    }
  }

  getFieldValue(row: T, field: string): unknown {
    return (row as unknown as Record<string, unknown>)[field] ?? null;
  }

  formatCellValue(row: T, field: string): string {
    const value = this.getFieldValue(row, field);
    if (value === null || value === undefined) return this.emptyCellValue;
    if (typeof value === 'boolean') {
      return this.translateService.instant(value ? 'COMMON.YES' : 'COMMON.NO');
    }
    if (value instanceof Date) return formatDate(value);
    return String(value);
  }

  getCellTemplate(field: string): TemplateRef<unknown> | null {
    return this.cellTemplateMap.get(field) ?? null;
  }

  /* ── Sayfalama ─────────────────────────────────────────── */

  /** p-table (onPage) — sayfa başlangıcını ve seçilen sayfa boyutunu kaydeder */
  onPageChange(event: { first: number; rows: number }): void {
    this.currentFirst = event.first;
    this.rowsPerPage = event.rows;
    this.savePageSize();
  }

  /** Görünür satır numarası — sayfa başına göre hesaplanır */
  rowNumberFor(index: number): number {
    return this.currentFirst + index + 1;
  }

  /** p-table rowTrackBy — gereksiz DOM güncellemelerini önler */
  trackByRow(index: number, row: T): unknown {
    return (row as unknown as Record<string, unknown>)['id'] ?? index;
  }

  /* ── Dışa Aktarma (Excel) ──────────────────────────────── */

  private get exportBaseName(): string {
    return this.exportFilename?.trim() || `tablo_${this.tableId}`;
  }

  /**
   * Görünür sütunlara göre dışa aktarma verisi üretir.
   * Aktif filtreler varsa yalnızca filtrelenmiş satırlar dışa aktarılır (E1).
   */
  private buildExportData(): { headers: string[]; rows: (string | number)[][] } {
    const headers = this.visibleColumns.map((col) => col.header);
    const sourceRows = this.dt?.filteredValue ?? this.rows;
    const rows = sourceRows.map((row) =>
      this.visibleColumns.map((col) => this.formatExportValue(row, col)),
    );
    return { headers, rows };
  }

  onExportExcel(): void {
    const { headers, rows } = this.buildExportData();
    exportToExcel(this.exportBaseName, headers, rows);
  }

  private formatExportValue(row: T, col: ColumnDef<T>): string {
    if (col.exportValue) {
      const custom = col.exportValue(row);
      if (custom !== null && custom !== undefined) return String(custom);
    }
    const value = this.getFieldValue(row, col.field);
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') {
      return this.translateService.instant(value ? 'COMMON.YES' : 'COMMON.NO');
    }
    if (value instanceof Date) return formatDate(value);
    return String(value);
  }

  /* ── Sayfa boyutu kalıcılığı ───────────────────────────── */

  private get pageSizeStorageKey(): string {
    return `ted_table_page_size_${this.tableId}`;
  }
  private loadPageSize(): void {
    try {
      const raw = localStorage.getItem(this.pageSizeStorageKey);
      if (raw) {
        const size = Number.parseInt(raw, 10);
        if (Number.isFinite(size) && [10, 25, 50].includes(size)) {
          this.rowsPerPage = size;
        }
      }
    } catch {
      /* localStorage erişilemiyorsa varsayılan 10 */
    }
  }

  private savePageSize(): void {
    try {
      localStorage.setItem(this.pageSizeStorageKey, String(this.rowsPerPage));
    } catch {
      /* localStorage doluysa sessizce geç */
    }
  }

  /* ── Sütun genişliği kalıcılığı ────────────────────────── */

  private get colWidthStorageKey(): string {
    return `ted_table_col_widths_${this.tableId}`;
  }

  /** Sütun genişliği — kullanıcı tercihi varsa onu, yoksa tanımlı genişliği döner */
  getColumnWidth(field: string): string | undefined {
    return this.columnWidths.get(field) ?? this.columns.find((col) => col.field === field)?.width;
  }

  /** p-table (onColResize) — yeni genişliği kaydeder */
  onColResize(event: TableColResizeEvent): void {
    const field = event.element.getAttribute('data-field');
    if (!field) return;
    this.columnWidths.set(field, `${event.element.offsetWidth}px`);
    this.saveColumnWidths();
  }

  private loadColumnWidths(): void {
    try {
      const raw = localStorage.getItem(this.colWidthStorageKey);
      if (raw) {
        const parsed: Record<string, string> = JSON.parse(raw);
        for (const field of Object.keys(parsed)) {
          if (this.allColumnFields.includes(field)) {
            this.columnWidths.set(field, parsed[field]);
          }
        }
      }
    } catch {
      /* bozuk veri yok sayılır */
    }
  }

  private saveColumnWidths(): void {
    try {
      localStorage.setItem(
        this.colWidthStorageKey,
        JSON.stringify(Object.fromEntries(this.columnWidths)),
      );
    } catch {
      /* localStorage doluysa sessizce geç */
    }
  }

  private refreshVisibleColumns(): void {
    const colMap = new Map(this.columns.map((col) => [col.field, col]));
    this.cachedVisibleColumns = this.selectedColumnFields
      .filter((field) => colMap.has(field))
      .map((field) => colMap.get(field)!);
  }

  private loadFromStorage(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        // Depolanan değerler hâlâ columns'ta var mı filtrele
        const filtered = parsed.filter((field) => this.allColumnFields.includes(field));
        // Yeni default alanları depolanan listeye ekle
        for (const field of this.defaultColumnFields) {
          if (!filtered.includes(field) && this.allColumnFields.includes(field)) {
            filtered.push(field);
          }
        }
        for (const field of this.alwaysVisibleFields) {
          if (!filtered.includes(field)) filtered.push(field);
        }
        return filtered;
      }
    } catch {
      /* localStorage bozuksa default'a dön */
    }
    return [...this.defaultColumnFields];
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.selectedColumnFields));
    } catch {
      /* localStorage doluysa sessizce geç */
    }
  }
}
