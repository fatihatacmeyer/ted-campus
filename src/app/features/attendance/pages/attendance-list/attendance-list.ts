import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputIconModule } from 'primeng/inputicon';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
  uniqueFilterOptions,
} from '../../../../shared/components/customizable-table/customizable-table';
import { StudentAttendanceRow } from '../../../../core/models/attendance.model';
import { AttendanceService } from '../../services/attendance.service';
import { computePeriodRange } from '../../../../shared/utils/date.utils';
import { TranslatePipe } from '@ngx-translate/core';

/** Period type: gün / hafta / ay. */
type Period = 'gun' | 'hafta' | 'ay';

/** Tab option for student attendance filtering. */
interface TabOption {
  label: string;
  tip: number;
}

@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [
    CommonModule,
    CustomizableTableComponent,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    InputIconModule,
    TranslatePipe,
  ],
  templateUrl: './attendance-list.html',
  styleUrl: './attendance-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceListComponent {
  private attendanceService = inject(AttendanceService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  /** Student attendance rows. */
  rows = signal<StudentAttendanceRow[]>([]);
  isLoading = signal(false);

  /** Active list tab: 0=Hepsi, 1=İzinliler, 2=Erken Çıkanlar, 3=Geç Kalanlar. */
  activeTab = signal<number>(0);

  /** Selected period type and date; range is computed from them. */
  period = signal<Period>('gun');
  selectedDate = signal<Date>(new Date());
  range = computed(() => computePeriodRange(this.period(), this.selectedDate()));

  /** Toolbar range label (dd-MM-yyyy - dd-MM-yyyy). */
  rangeLabel = computed(() => {
    const { baslangic, bitis } = this.range();
    return `${this.toDisplayDate(baslangic)} - ${this.toDisplayDate(bitis)}`;
  });

  /** Search query for student name filtering. */
  searchQuery = signal('');

  /** Students who have a leave — shown in the side panel. */
  leaveStudents = computed(() =>
    this.rows().filter((r) => r.izinTipi != null && r.izinTipi !== ''),
  );

  /** Tab options: 0=Hepsi, 1=İzinliler, 2=Erken Çıkanlar, 3=Geç Kalanlar. */
  tabOptions: TabOption[] = [
    { label: 'STUDENT_ATTENDANCE.TAB_ALL', tip: 0 },
    { label: 'STUDENT_ATTENDANCE.TAB_ON_LEAVE', tip: 1 },
    { label: 'STUDENT_ATTENDANCE.TAB_EARLY_LEAVERS', tip: 2 },
    { label: 'STUDENT_ATTENDANCE.TAB_LATE_ARRIVALS', tip: 3 },
  ];

  /** Empty cell rendering. */
  readonly emptyCellValue = '-';

  /** Student attendance columns. */
  columns: ColumnDef<StudentAttendanceRow>[] = [
    {
      field: 'sicilNo',
      header: 'STUDENT_ATTENDANCE.COL_SICIL_NO',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'sicilNo'),
    },
    {
      field: 'adSoyad',
      header: 'STUDENT_ATTENDANCE.COL_AD_SOYAD',
      sortable: true,
      alwaysVisible: true,
    },
    {
      field: 'sinif',
      header: 'STUDENT_ATTENDANCE.COL_SINIF',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'sinif'),
    },
    {
      field: 'kampus',
      header: 'STUDENT_ATTENDANCE.COL_KAMPUS',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'kampus'),
    },
    { field: 'egitimDuzeyi', header: 'STUDENT_ATTENDANCE.COL_EGITIM_DUZEYI', sortable: true },
    { field: 'tarih', header: 'STUDENT_ATTENDANCE.COL_TARIH', sortable: true },
    { field: 'girisSaati', header: 'STUDENT_ATTENDANCE.COL_GIRIS', sortable: true },
    { field: 'cikisSaati', header: 'STUDENT_ATTENDANCE.COL_CIKIS', sortable: true },
    { field: 'gecKalmaSuresiDk', header: 'STUDENT_ATTENDANCE.COL_GEC_KALMA', sortable: true },
    { field: 'erkenCikmaSuresiDk', header: 'STUDENT_ATTENDANCE.COL_ERKEN_CIKMA', sortable: true },
    { field: 'izinTipi', header: 'STUDENT_ATTENDANCE.COL_IZIN_TIPI' },
    { field: 'izinSaatAraligi', header: 'STUDENT_ATTENDANCE.COL_IZIN_SAAT_ARALIGI' },
    { field: 'okulSaatleri', header: 'STUDENT_ATTENDANCE.COL_OKUL_SAATLERI' },
  ];

  defaultFields = [
    'sicilNo',
    'adSoyad',
    'sinif',
    'kampus',
    'egitimDuzeyi',
    'tarih',
    'girisSaati',
    'cikisSaati',
    'gecKalmaSuresiDk',
    'erkenCikmaSuresiDk',
    'izinTipi',
    'izinSaatAraligi',
    'okulSaatleri',
  ];

  constructor() {
    this.loadRows();
  }

  /** Converts 'yyyy-MM-dd' to dd-MM-yyyy display format. */
  private toDisplayDate(dateStr: string): string {
    return dateStr.split('-').reverse().join('-');
  }

  /** Fetches student attendance rows for the active tab and period range. */
  loadRows(): void {
    this.isLoading.set(true);
    const { baslangic, bitis } = this.range();
    this.attendanceService
      .getStudentAttendanceRows({
        GosterimTuru: this.activeTab() as 0 | 1 | 2 | 3,
        baslangic,
        bitis,
        adSoyadArama: this.searchQuery() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.rows.set(list ?? []);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[AttendanceListComponent] loadRows error:', err);
          this.notification.error('STUDENT_ATTENDANCE.ERROR_LOAD');
          this.rows.set([]);
          this.isLoading.set(false);
        },
      });
  }

  /** Applies tab change and refreshes the list. */
  onTabChange(tip: number): void {
    this.activeTab.set(tip);
    this.loadRows();
  }

  /** Applies student name search and refreshes the list. */
  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.loadRows();
  }

  /** Changes period type; resets the date to today and refreshes the list. */
  setPeriod(p: Period): void {
    if (this.period() === p) return;
    this.period.set(p);
    this.selectedDate.set(new Date());
    this.loadRows();
  }

  /** Steps one period back. */
  prevPeriod(): void {
    this.shiftPeriod(-1);
  }

  /** Steps one period forward. */
  nextPeriod(): void {
    this.shiftPeriod(1);
  }

  /** Shifts the date by the period unit. */
  private shiftPeriod(delta: number): void {
    const current = this.selectedDate();
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    if (this.period() === 'gun') {
      next.setDate(next.getDate() + delta);
    } else if (this.period() === 'hafta') {
      next.setDate(next.getDate() + delta * 7);
    } else {
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
    }
    this.selectedDate.set(next);
    this.loadRows();
  }

  /** Returns to today's period and refreshes the list. */
  goToday(): void {
    this.selectedDate.set(new Date());
    this.loadRows();
  }
}
