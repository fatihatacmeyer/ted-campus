import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Person, resolveLinkedNames, extractLinkedPersonIds, extractLinkedTeacherIds } from '../../../core/models/person.model';
import { TableColResizeEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { exportToExcel } from '../../utils/table-export.utils';


export interface ColumnDef {
  field: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
}

@Component({
  selector: 'app-person-table',
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
  templateUrl: './person-table.html',
  styleUrl: './person-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonTableComponent implements OnInit, OnChanges {
  @Input() persons: Person[] = [];
  @Input() title = '';
  @Input() loading = false;
  @Input() tableId = 'default';
  @Input() columnOverrides: { field: string; header: string }[] = [];
  @Input() allPersons: Person[] = [];
  @Output() rowClick = new EventEmitter<Person>();
  @Output() leaveRequest = new EventEmitter<Person>();

  @Input() showLeaveButton = false;
  @Input() showActionsColumn = true;

  allColumns: ColumnDef[] = [
    { field: 'ad', header: 'Ad', sortable: true, filterable: true },
    { field: 'soyad', header: 'Soyad', sortable: true, filterable: true },
    { field: 'sicilno', header: 'Sicil No', sortable: true, filterable: true },
    //{ field: 'firma', header: 'Firma', sortable: true },
    { field: 'firmaad', header: 'Firma', sortable: true },
    { field: 'bolumad', header: 'Bölüm', sortable: true },
    { field: 'pozisyonad', header: 'Pozisyon', sortable: true },
    { field: 'ceptelefon', header: 'Telefon' },
    { field: 'id', header: 'ID', sortable: true },
    { field: 'personelno', header: 'Personel No', sortable: true },
    { field: 'linkedTeachers', header: 'Öğretmenler', sortable: false },
    { field: 'userid', header: 'User ID' },
    { field: 'altfirmaad', header: 'Alt Firma' },
    { field: 'direktorlukad', header: 'Direktörlük' },
    { field: 'gorevad', header: 'Görev' },
    { field: 'yakaad', header: 'Yaka' },
    { field: 'credit', header: 'Kredi' },
    { field: 'indirimorani', header: 'İndirim Oranı' },
    { field: 'mesaiperiyodu', header: 'Mesai Periyodu' },
    { field: 'mesaiperiyoduad', header: 'Mesai Periyodu Adı' },
    { field: 'cikistarih', header: 'Çıkış Tarihi' },
    { field: 'lyetki', header: 'L Yetki' },
    { field: 'lkademe', header: 'L Kademe' },
    { field: 'userdef', header: 'User Def' },
    { field: 'userdefad', header: 'User Def Adı' },
    { field: 'cardid', header: 'Kart ID' },
    { field: 'yetkistr', header: 'Yetki Str' },
    { field: 'yetkistrad', header: 'Yetki Str Adı' },
  ];

  /** Her zaman görünür olan sütunlar — kaldırılamaz */
  private readonly alwaysVisible = ['ad', 'soyad'];

  private readonly defaultFields = [
    'ad',
    'soyad',
    'sicilno',
    //'firma',
    'firmaad',
    'personelno',
    'bolumad',
    'pozisyonad',
    'ceptelefon',
  ];

  selectedColumnFields: string[] = [];

  showColumnPanel = false;
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;

  filterText = '';

  /** Kullanıcının seçtiği sayfa boyutu — localStorage'da saklanır */
  rowsPerPage = 10;

  /** Kullanıcının yeniden boyutlandırdığı sütun genişlikleri (field → css değeri) */
  private columnWidths = new Map<string, string>();

  private get storageKey(): string {
    return `ted_table_columns_${this.tableId}`;
  }

  private get colWidthStorageKey(): string {
    return `ted_table_col_widths_${this.tableId}`;
  }

  ngOnInit(): void {
    this.loadPageSize();
    this.loadColumnWidths();
    this.selectedColumnFields = this.loadFromStorage();
    this.applyColumnOverrides();
    this.refreshVisibleColumns();
    this.colHeaderMap = new Map(this.allColumns.map(c => [c.field, c.header]));
  }

  get globalFilterFields(): string[] {
    return this.allColumns.map((col) => col.field);
  }

  private cachedVisibleColumns: ColumnDef[] = [];

  private refreshVisibleColumns(): void {
    const colMap = new Map(this.allColumns.map(col => [col.field, col]));
    this.cachedVisibleColumns = this.selectedColumnFields
      .filter(field => colMap.has(field))
      .map(field => colMap.get(field)!);
  }

  get visibleColumns(): ColumnDef[] {
    return this.cachedVisibleColumns;
  }

  getFieldValue(person: Person, field: string): string | number | boolean | null {
    return (person as unknown as Record<string, string | number | boolean | null>)[field] ?? null;
  }

  private linkedDisplayCache = new Map<number, string>();
  private teacherLinkedDisplayCache = new Map<number, string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['persons'] || changes['allPersons']) {
      this.rebuildLinkedDisplayCache();
    }
  }

  private rebuildLinkedDisplayCache(): void {
    this.linkedDisplayCache.clear();
    this.teacherLinkedDisplayCache.clear();
    if (!this.allPersons.length) return;
    for (const person of this.persons) {
      const parentIds = extractLinkedPersonIds(person.personelno);
      this.linkedDisplayCache.set(person.id, parentIds.length === 0 ? '-' : resolveLinkedNames(parentIds, this.allPersons).map(l => l.name).join(', '));
      const teacherIds = extractLinkedTeacherIds(person.personelno);
      this.teacherLinkedDisplayCache.set(person.id, teacherIds.length === 0 ? '-' : resolveLinkedNames(teacherIds, this.allPersons).map(l => l.name).join(', '));
    }
  }

  getLinkedDisplay(person: Person): string {
    return this.linkedDisplayCache.get(person.id) ?? '-';
  }

  getTeacherLinkedDisplay(person: Person): string {
    return this.teacherLinkedDisplayCache.get(person.id) ?? '-';
  }

  /* ── Sayfalama ─────────────────────────────────────────── */

  /** p-table (onPage) — seçilen sayfa boyutunu kalıcı hale getirir */
  onPageChange(event: { first: number; rows: number }): void {
    this.rowsPerPage = event.rows;
    this.savePageSize();
  }

  /** p-table rowTrackBy — gereksiz DOM güncellemelerini önler */
  trackByRow(index: number, row: Person): unknown {
    return row.id ?? index;
  }

  /* ── Dışa Aktarma (Excel) ──────────────────────────────── */

  private get exportBaseName(): string {
    return `person_liste_${this.tableId}`;
  }

  /** Görünür sütunlara göre dışa aktarma verisi üretir (kullanıcının sütun tercihini yansıtır) */
  private buildExportData(): { headers: string[]; rows: (string | number)[][] } {
    const headers = this.visibleColumns.map((col) => col.header);
    const rows = this.persons.map((person) =>
      this.visibleColumns.map((col) => this.formatExportValue(person, col.field)),
    );
    return { headers, rows };
  }

  onExportExcel(): void {
    const { headers, rows } = this.buildExportData();
    exportToExcel(this.exportBaseName, headers, rows);
  }

  /** Person'a özel render'ları (linkedDisplay vb.) dışa aktarmaya yansıtır */
  private formatExportValue(person: Person, field: string): string {
    if (field === 'personelno' && this.allPersons.length) return this.getLinkedDisplay(person);
    if (field === 'linkedTeachers' && this.allPersons.length) return this.getTeacherLinkedDisplay(person);
    const value = this.getFieldValue(person, field);
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
    if (field === 'indirimorani') return `${value}%`;
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

  /** Sütun genişliği — kullanıcı tercihi varsa onu döner */
  getColumnWidth(field: string): string | undefined {
    return this.columnWidths.get(field);
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
          if (this.allColumns.some((col) => col.field === field)) {
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

  /* ── Selection & Leave ─────────────────────────────────── */

  onLeaveRequest(event: Event, person: Person): void {
    event.stopPropagation();
    this.leaveRequest.emit(person);
  }

  /* ── Column Selector Panel ─────────────────────────────── */

  get hiddenColumns(): string[] {
    return this.allColumns
      .map(c => c.field)
      .filter(f => !this.selectedColumnFields.includes(f));
  }

  private colHeaderMap = new Map<string, string>();

  getColHeader(field: string): string {
    return this.colHeaderMap.get(field) ?? field;
  }

  isAlwaysVisible(field: string): boolean {
    return this.alwaysVisible.includes(field);
  }

  toggleColumn(field: string): void {
    const idx = this.selectedColumnFields.indexOf(field);
    if (idx >= 0) {
      if (this.alwaysVisible.includes(field)) return;
      this.selectedColumnFields.splice(idx, 1);
    } else {
      this.selectedColumnFields.push(field);
    }
    this.refreshVisibleColumns();
    this.saveToStorage();
  }

  /* ── Drag & Drop ───────────────────────────────────────── */

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

  private applyColumnOverrides(): void {
    for (const override of this.columnOverrides) {
      const col = this.allColumns.find((c) => c.field === override.field);
      if (col) {
        col.header = override.header;
      }
    }
  }

  /** Multiselect değiştiğinde çağrılır — her zaman görünür sütunları korur + localStorage'a kaydeder */
  onColumnsChanged(): void {
    // Her zaman görünür sütunları zorla ekle
    for (const field of this.alwaysVisible) {
      if (!this.selectedColumnFields.includes(field)) {
        this.selectedColumnFields.push(field);
      }
    }
    this.refreshVisibleColumns();
    this.saveToStorage();
  }

  /** X tuşuna basıldığında — varsayılan sütunlara dön */
  onClearColumns(): void {
    this.selectedColumnFields = [...this.defaultFields];
    this.refreshVisibleColumns();
    this.saveToStorage();
  }

  private loadFromStorage(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        // Depolanan değerler hâlâ allColumns'ta var mı filtrele
        const validFields = this.allColumns.map((c) => c.field);
        const filtered = parsed.filter((f) => validFields.includes(f));
        // Yeni default alanları Depolanan listeye ekle
        for (const field of this.defaultFields) {
          if (!filtered.includes(field) && validFields.includes(field)) {
            filtered.push(field);
          }
        }
        for (const field of this.alwaysVisible) {
          if (!filtered.includes(field)) filtered.push(field);
        }
        return filtered;
      }
    } catch {
      /* localStorage bozuksa default'a dön */
    }
    return [...this.defaultFields];
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.selectedColumnFields));
    } catch {
      /* localStorage doluysa sessizce geç */
    }
  }
}
