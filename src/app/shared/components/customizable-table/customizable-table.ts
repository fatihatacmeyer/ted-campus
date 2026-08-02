import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  Directive,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnInit,
  Output,
  QueryList,
  TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableColResizeEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { formatDate } from '../../utils/date.utils';
import { exportToExcel } from '../../utils/table-export.utils';

export interface ColumnDef<T = unknown> {
  field: string; // veri alanı adı
  header: string; // başlık
  sortable?: boolean;
  width?: string; // css genişliği (örn '70px')
  alwaysVisible?: boolean; // panelden kaldırılamaz
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
  @Input() emptyMessage = 'Kayıt bulunamadı.';
  @Input() showSearch = true;
  @Input() searchPlaceholder = 'Arama';
  @Input() rowClickable = false;
  @Input() actionsTemplate: TemplateRef<{ $implicit: T }> | null = null; // her satırın sonundaki sabit İşlemler sütunu
  @Input() exportable = true; // Dışa Aktar (Excel/CSV) butonu
  @Input() exportFilename = ''; // varsayılan: tablo_${tableId}
  @Output() rowClick = new EventEmitter<T>();

  @ContentChildren(ColumnCellDirective) cellDirectives!: QueryList<ColumnCellDirective>;

  selectedColumnFields: string[] = [];

  showColumnPanel = false;
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;

  filterText = '';

  /** Kullanıcının seçtiği sayfa boyutu — localStorage'da saklanır */
  rowsPerPage = 10;

  private destroyRef = inject(DestroyRef);

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
    this.selectedColumnFields = this.loadFromStorage();
    this.refreshVisibleColumns();
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

  getColHeader(field: string): string {
    return this.columns.find((col) => col.field === field)?.header ?? field;
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

  getFieldValue(row: T, field: string): unknown {
    return (row as unknown as Record<string, unknown>)[field] ?? null;
  }

  formatCellValue(row: T, field: string): string {
    const value = this.getFieldValue(row, field);
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
    if (value instanceof Date) return formatDate(value);
    return String(value);
  }

  getCellTemplate(field: string): TemplateRef<unknown> | null {
    return this.cellTemplateMap.get(field) ?? null;
  }

  /* ── Sayfalama ─────────────────────────────────────────── */

  /** p-table (onPage) — seçilen sayfa boyutunu kalıcı hale getirir */
  onPageChange(event: { first: number; rows: number }): void {
    this.rowsPerPage = event.rows;
    this.savePageSize();
  }

  /** p-table rowTrackBy — gereksiz DOM güncellemelerini önler */
  trackByRow(index: number, row: T): unknown {
    return (row as unknown as Record<string, unknown>)['id'] ?? index;
  }

  /* ── Dışa Aktarma (Excel) ──────────────────────────────── */

  private get exportBaseName(): string {
    return this.exportFilename?.trim() || `tablo_${this.tableId}`;
  }

  /** Görünür sütunlara göre dışa aktarma verisi üretir (kullanıcının sütun tercihini yansıtır) */
  private buildExportData(): { headers: string[]; rows: (string | number)[][] } {
    const headers = this.visibleColumns.map((col) => col.header);
    const rows = this.rows.map((row) =>
      this.visibleColumns.map((col) => this.formatExportValue(row, col.field)),
    );
    return { headers, rows };
  }

  onExportExcel(): void {
    const { headers, rows } = this.buildExportData();
    exportToExcel(this.exportBaseName, headers, rows);
  }

  private formatExportValue(row: T, field: string): string {
    const value = this.getFieldValue(row, field);
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
    if (value instanceof Date) return formatDate(value);
    return String(value);
  }

  /* ── Sayfa boyutu kalıcılığı ───────────────────────────── */

  private get pageSizeStorageKey(): string {
    return `ted_table_page_size_${this.tableId}`;
  }  private loadPageSize(): void {
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
      localStorage.setItem(this.colWidthStorageKey, JSON.stringify(Object.fromEntries(this.columnWidths)));
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
