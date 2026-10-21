import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ChangeDetectorRef,
  ContentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  inject,
  Input,
  OnInit,
  Output,
  QueryList,
  TemplateRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterService } from 'primeng/api';
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
import {
  buildClassGroups,
  ClassGroup,
  extractClassNames,
  matchesClassSelection,
} from '../../utils/class-name.utils';

import { TABLE_FILTER_STORAGE_PREFIX } from '../../config/table-storage';

const CLASS_MATCH_MODE = 'classSelection';

export interface FilterOption {
  label: string;
  value: unknown;
}

export interface ColumnDef<T = unknown> {
  field: string;
  header: string;
  headerTooltip?: string;
  sortable?: boolean;
  width?: string;
  alwaysVisible?: boolean;
  filterType?: 'text' | 'select' | 'class';
  filterOptions?: FilterOption[] | ((rows: T[]) => FilterOption[]);
  exportValue?: (row: T) => string | number | null;
  filterable?: boolean;
}

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
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
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
  implements OnInit, AfterContentInit, AfterViewInit
{
  @Input() rows: T[] = [];
  @Input() columns: ColumnDef<T>[] = [];
  @Input() loading = false;
  @Input() persistFilters = true;
  @Input() tableId = 'default';
  @Input() defaultFields: string[] | null = null;
  @Input() emptyMessage = 'COMMON.NO_RECORDS';
  @Input() emptyCellValue = '-';
  @Input() showSearch = true;
  @Input() showColumnSelector = true;
  @Input() searchPlaceholder = 'COMMON.SEARCH';
  @Input() rowClickable = false;
  @Input() actionsTemplate: TemplateRef<{ $implicit: T }> | null = null;
  @Input() exportable = true;
  @Input() exportFilename = '';
  @Input() showRowNumbers = false;
  @Input() rowNumberHeader = '#';
  @Input() selectionMode: 'single' | 'multiple' | null = null;
  @Input() selectedRows: T[] = [];

  @Input() displayMode: 'paginated' | 'scroll' | 'fit' = 'paginated';
  @Input() scrollHeight = 'calc(100vh - 240px)';

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

  rowsPerPage = 10;

  @ViewChild('dt', { static: false }) dt!: Table;

  filterPopup: { col: ColumnDef<T>; x: number; y: number } | null = null;

  private filterAnchor: { el: HTMLElement; top: number; left: number } | null = null;

  private columnFilters = new Map<string, unknown>();

  private currentFirst = 0;

  private destroyRef = inject(DestroyRef);
  private hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private translateService = inject(TranslateService);
  private primeFilterService = inject(FilterService);
  private classGroupCache = new Map<string, { rows: T[]; groups: ClassGroup[] }>();

  private cellTemplateMap = new Map<string, TemplateRef<unknown>>();

  private cachedVisibleColumns: ColumnDef<T>[] = [];

  private columnWidths = new Map<string, string>();

  private get storageKey(): string {
    return `ted_table_columns_${this.tableId}`;
  }

  private get alwaysVisibleFields(): string[] {
    return this.columns.filter((col) => col.alwaysVisible).map((col) => col.field);
  }

  private get defaultColumnFields(): string[] {
    return this.defaultFields ?? this.columns.map((col) => col.field);
  }

  private get allColumnFields(): string[] {
    return this.columns.map((col) => col.field);
  }

  ngOnInit(): void {
    this.primeFilterService.register(CLASS_MATCH_MODE, (value: unknown, filter: string[] | null) =>
      matchesClassSelection(extractClassNames(value as string | null), filter),
    );
    this.listenScrollToCloseFilter();
    this.loadPageSize();
    this.loadColumnWidths();
    this.loadColumnFilters();
    this.selectedColumnFields = this.loadFromStorage();
    this.refreshVisibleColumns();
  }

  ngAfterViewInit(): void {
    for (const [field, value] of this.columnFilters) {
      const col = this.columns.find((c) => c.field === field);
      if (col) {
        this.dt?.filter(value, field, this.getMatchMode(col));
      }
    }
    if (this.filterText) {
      this.dt?.filterGlobal(this.filterText, 'contains');
    }
    const onScroll = (event: Event): void => {
      if (this.filterPopup) {
        const target = event.target as HTMLElement | null;

        if (target?.closest && target.closest('.col-filter-popup, .p-select-overlay')) {
          return;
        }

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

  private selectionSource(): T[] {
    return (this.dt?.filteredValue as T[] | null | undefined) ?? this.rows ?? [];
  }

  isRowSelected(row: T): boolean {
    return this.selectedRows.includes(row);
  }

  onRowSelectionChange(row: T, checked: boolean): void {
    let next: T[];
    if (checked) {
      next = this.selectionMode === 'single' ? [row] : [...this.selectedRows, row];
    } else {
      next = this.selectedRows.filter((r) => r !== row);
    }
    this.selectedRowsChange.emit(next);
  }

  isAllRowsSelected(): boolean {
    const source = this.selectionSource();
    return source.length > 0 && source.every((r) => this.selectedRows.includes(r));
  }

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

  onClearColumns(): void {
    this.selectedColumnFields = [...this.defaultColumnFields];
    this.refreshVisibleColumns();
    this.saveToStorage();
  }

  /* Sütun Filtreleri */

  getColumnFilterType(col: ColumnDef<T>): 'text' | 'select' | 'class' {
    if (col.filterType === 'class') return 'class';
    return col.filterType === 'select' || col.filterOptions !== undefined ? 'select' : 'text';
  }

  private getMatchMode(col: ColumnDef<T>): string {
    const type = this.getColumnFilterType(col);
    return type === 'class' ? CLASS_MATCH_MODE : type === 'select' ? 'equals' : 'contains';
  }

  get hasActiveFilters(): boolean {
    return this.columnFilters.size > 0;
  }

  getActiveFilterColumn(): ColumnDef<T> | null {
    return this.filterPopup?.col ?? null;
  }

  hasFilterOn(field: string): boolean {
    return this.columnFilters.has(field);
  }

  onFilterBtnClick(event: MouseEvent, col: ColumnDef<T>): void {
    event.stopPropagation();
    if (this.filterPopup?.col.field === col.field) {
      this.filterPopup = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const isClassFilter = this.getColumnFilterType(col) === 'class';
    const popupWidth = isClassFilter ? 300 : 220;
    const popupHeight = isClassFilter ? 440 : 140;
    let x = rect.left;
    let y = rect.bottom + 4;
    if (x + popupWidth > window.innerWidth) {
      x = Math.max(8, window.innerWidth - popupWidth - 8);
    }
    if (y + popupHeight > window.innerHeight) {
      y = Math.max(8, rect.top - popupHeight - 4);
    }
    const origin = this.fixedContainingBlockOrigin();
    this.filterPopup = { col, x: x - origin.x, y: y - origin.y };
    this.filterAnchor = { el: btn, top: rect.top, left: rect.left };
  }

  private fixedContainingBlockOrigin(): { x: number; y: number } {
    let el: HTMLElement | null = this.hostRef.nativeElement;
    while (el && el !== document.body && el !== document.documentElement) {
      const s = getComputedStyle(el);
      const createsBlock =
        s.transform !== 'none' ||
        s.perspective !== 'none' ||
        s.filter !== 'none' ||
        (s.backdropFilter ?? 'none') !== 'none' ||
        /paint|layout|strict|content/.test(s.contain) ||
        /transform|perspective|filter/.test(s.willChange);
      if (createsBlock) {
        const r = el.getBoundingClientRect();
        return { x: r.left + el.clientLeft, y: r.top + el.clientTop };
      }
      el = el.parentElement;
    }
    return { x: 0, y: 0 };
  }

  private listenScrollToCloseFilter(): void {
    const onScroll = (event: Event) => {
      const anchor = this.filterAnchor;
      if (!this.filterPopup || !anchor) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.col-filter-popup, .p-select-overlay')) {
        return;
      }
      const rect = anchor.el.getBoundingClientRect();
      if (Math.abs(rect.top - anchor.top) < 1 && Math.abs(rect.left - anchor.left) < 1) return;
      this.closeFilterPopup();
      this.cdr.markForCheck();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('scroll', onScroll, { capture: true }),
    );
  }

  closeFilterPopup(): void {
    this.filterPopup = null;
  }

  clearColumnFilter(col: ColumnDef<T>): void {
    this.columnFilters.delete(col.field);
    this.dt?.filter(null, col.field, this.getMatchMode(col));
    this.saveColumnFilters();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClickFilter(event: MouseEvent): void {
    if (!this.filterPopup) return;
    const target = event.target as HTMLElement | null;
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

  getFilterOptions(col: ColumnDef<T>): FilterOption[] {
    const opts =
      typeof col.filterOptions === 'function' ? col.filterOptions(this.rows) : col.filterOptions;
    return opts ?? [];
  }

  /* Sınıf filtresi (seviye + şube çoklu seçim) */

  getClassGroups(col: ColumnDef<T>): ClassGroup[] {
    const cached = this.classGroupCache.get(col.field);
    if (cached && cached.rows === this.rows) return cached.groups;
    const names = new Set<string>();
    for (const row of this.rows) {
      const cell = (row as Record<string, unknown>)[col.field];
      extractClassNames(typeof cell === 'string' ? cell : null).forEach((n) => names.add(n));
    }
    const groups = buildClassGroups(names);
    this.classGroupCache.set(col.field, { rows: this.rows, groups });
    return groups;
  }

  private classTokens(col: ColumnDef<T>): string[] {
    const value = this.columnFilters.get(col.field);
    return Array.isArray(value) ? (value as string[]) : [];
  }

  isGradeSelected(col: ColumnDef<T>, group: ClassGroup): boolean {
    return this.classTokens(col).includes(group.key);
  }

  isGradePartial(col: ColumnDef<T>, group: ClassGroup): boolean {
    const tokens = this.classTokens(col);
    return !tokens.includes(group.key) && tokens.some((t) => t.startsWith(`${group.key}/`));
  }

  isSectionSelected(col: ColumnDef<T>, group: ClassGroup, section: string): boolean {
    const tokens = this.classTokens(col);
    return tokens.includes(group.key) || tokens.includes(`${group.key}/${section}`);
  }

  toggleGrade(col: ColumnDef<T>, group: ClassGroup): void {
    const prefix = `${group.key}/`;
    const rest = this.classTokens(col).filter((t) => t !== group.key && !t.startsWith(prefix));
    const hasAny = this.isGradeSelected(col, group) || this.isGradePartial(col, group);
    this.onColumnFilterChange(col, hasAny ? rest : [...rest, group.key]);
  }

  toggleSection(col: ColumnDef<T>, group: ClassGroup, section: string): void {
    const prefix = `${group.key}/`;
    const tokens = this.classTokens(col);
    const rest = tokens.filter((t) => t !== group.key && !t.startsWith(prefix));
    let selected = tokens.includes(group.key)
      ? group.sections
      : group.sections.filter((s) => tokens.includes(prefix + s));

    selected = selected.includes(section)
      ? selected.filter((s) => s !== section)
      : [...selected, section];

    const next =
      selected.length === group.sections.length
        ? [...rest, group.key]
        : [...rest, ...selected.map((s) => prefix + s)];
    this.onColumnFilterChange(col, next);
  }

  getColumnFilterValue(field: string): unknown {
    return this.columnFilters.get(field) ?? null;
  }

  onColumnFilterChange(col: ColumnDef<T>, value: unknown): void {
    const matchMode = this.getMatchMode(col);
    const isEmptyArray = Array.isArray(value) && value.length === 0;
    if (value === null || value === undefined || value === '' || isEmptyArray) {
      this.columnFilters.delete(col.field);
      this.dt?.filter(null, col.field, matchMode);
    } else {
      this.columnFilters.set(col.field, value);
      this.dt?.filter(value, col.field, matchMode);
    }
    this.saveColumnFilters();
  }

  onSearchChange(value: string): void {
    this.filterText = value ?? '';
    this.dt?.filterGlobal(this.filterText, 'contains');
    this.saveColumnFilters();
  }

  get activeFilterCount(): number {
    return this.columnFilters.size + (this.filterText ? 1 : 0);
  }

  clearColumnFilters(): void {
    for (const col of this.columns) {
      this.columnFilters.delete(col.field);
      this.dt?.filter(null, col.field, this.getMatchMode(col));
    }
    this.filterText = '';
    this.dt?.filterGlobal('', 'contains');
    this.saveColumnFilters();
  }

  private get filterStorageKey(): string {
    return `${TABLE_FILTER_STORAGE_PREFIX}${this.tableId}`;
  }

  private loadColumnFilters(): void {
    if (!this.persistFilters) return;
    try {
      const raw = sessionStorage.getItem(this.filterStorageKey);
      if (raw) {
        const parsed: { columns?: Record<string, unknown>; search?: string } = JSON.parse(raw);
        for (const col of this.columns) {
          const value = parsed.columns?.[col.field];
          if (value !== undefined && value !== null && value !== '') {
            this.columnFilters.set(col.field, value);
          }
        }
        if (typeof parsed.search === 'string') {
          this.filterText = parsed.search;
        }
      }
    } catch {
      /* bozuk veri yok sayılır */
    }
  }

  private saveColumnFilters(): void {
    if (!this.persistFilters) return;
    try {
      if (this.activeFilterCount === 0) {
        sessionStorage.removeItem(this.filterStorageKey);
        return;
      }
      sessionStorage.setItem(
        this.filterStorageKey,
        JSON.stringify({
          columns: Object.fromEntries(this.columnFilters),
          search: this.filterText,
        }),
      );
    } catch {
      /* depolama doluysa sessizce geç */
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

  /* Sayfalama */

  onPageChange(event: { first: number; rows: number }): void {
    this.currentFirst = event.first;
    this.rowsPerPage = event.rows;
    this.savePageSize();
  }

  rowNumberFor(index: number): number {
    // return this.currentFirst + index + 1;
    return index + 1;
  }

  trackByRow(index: number, row: T): unknown {
    return (row as unknown as Record<string, unknown>)['id'] ?? index;
  }

  /* Dışa Aktarma (Excel) */

  private get exportBaseName(): string {
    return this.exportFilename?.trim() || `tablo_${this.tableId}`;
  }

  private buildExportData(): { headers: string[]; rows: (string | number)[][] } {
    const headers = this.visibleColumns.map((col) => this.translateService.instant(col.header));
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

  /* Sayfa boyutu kalıcılığı */

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

  /* Sütun genişliği kalıcılığı */

  private get colWidthStorageKey(): string {
    return `ted_table_col_widths_${this.tableId}`;
  }

  getColumnWidth(field: string): string | undefined {
    return this.columnWidths.get(field) ?? this.columns.find((col) => col.field === field)?.width;
  }

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
        const filtered = parsed.filter((field) => this.allColumnFields.includes(field));
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
