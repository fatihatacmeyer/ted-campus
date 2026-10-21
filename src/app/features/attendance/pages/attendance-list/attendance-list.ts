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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { unwrapResponse } from '../../../../shared/utils/response.utils';
import { DialogModule } from 'primeng/dialog';
import { PersonLeaveDialogComponent } from '../../../persons/components/person-leave-dialog/person-leave-dialog';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';

type Period = 'gun' | 'hafta' | 'ay';

interface TabOption {
  label: string;
  tip: number;
}

@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [
    PageHeaderComponent,
    CommonModule,
    CustomizableTableComponent,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    InputIconModule,
    TranslatePipe,
    DialogModule,
    ConfirmDialogModule,
    PersonLeaveDialogComponent,
    ColumnCellDirective,
  ],
  templateUrl: './attendance-list.html',
  styleUrl: './attendance-list.scss',
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceListComponent {
  private attendanceService = inject(AttendanceService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private confirmationService = inject(ConfirmationService);
  private translate = inject(TranslateService);

  selectedRows = signal<StudentAttendanceRow[]>([]);
  leaveIconDialogVisible = signal(false);
  selectedLeaveRow = signal<StudentAttendanceRow | null>(null);

  assignLeaveDialogVisible = signal(false);
  assignLeaveTargets = signal<{ id: number; adSoyad: string }[]>([]);

  editLeaveDialogVisible = signal(false);
  editLeaveTargets = signal<{ id: number; adSoyad: string }[]>([]);
  editLeaveId = signal<number | null>(null);

  rows = signal<StudentAttendanceRow[]>([]);
  isLoading = signal(false);

  activeTab = signal<number>(0);

  period = signal<Period>('gun');
  selectedDate = signal<Date>(new Date());
  range = computed(() => computePeriodRange(this.period(), this.selectedDate()));

  rangeLabel = computed(() => {
    const { baslangic, bitis } = this.range();
    return `${this.toDisplayDate(baslangic)} - ${this.toDisplayDate(bitis)}`;
  });

  searchQuery = signal('');

  selectedLeaveIds = computed(() => [
    ...new Set(
      this.selectedRows()
        .map((r) => r.izinId)
        .filter((id): id is number => id != null),
    ),
  ]);

  leaveStudents = computed(() =>
    this.selectedRows().filter((r) => r.izinTipi != null && r.izinTipi !== ''),
  );

  tabOptions: TabOption[] = [
    { label: 'STUDENT_ATTENDANCE.TAB_ALL', tip: 0 },
    { label: 'STUDENT_ATTENDANCE.TAB_ON_LEAVE', tip: 1 },
    { label: 'STUDENT_ATTENDANCE.TAB_EARLY_LEAVERS', tip: 2 },
    { label: 'STUDENT_ATTENDANCE.TAB_LATE_ARRIVALS', tip: 3 },
  ];

  readonly emptyCellValue = '-';

  columns: ColumnDef<StudentAttendanceRow>[] = [
    {
      field: 'izinIkon',
      header: 'STUDENT_ATTENDANCE.COL_ICON',
      sortable: false,
      width: '45px',
      alwaysVisible: true,
      filterable: false,
    },
    //{ field: 'sicilId', header: '', sortable: true },
    {
      field: 'sicilNo',
      header: 'SN',
      headerTooltip: 'STUDENT_ATTENDANCE.COL_SICIL_NO',
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
    { field: 'gelisServisPlaka', header: 'STUDENT_ATTENDANCE.COL_GELIS_SERVIS', sortable: true },
    { field: 'donusServisPlaka', header: 'STUDENT_ATTENDANCE.COL_DONUS_SERVIS', sortable: true },
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
    'izinIkon',
    'sicilNo',
    'adSoyad',
    'sinif',
    'kampus',
    'egitimDuzeyi',
    'gelisServisPlaka',
    'donusServisPlaka',
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

  private toDisplayDate(dateStr: string): string {
    return dateStr.split('-').reverse().join('-');
  }

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

  onTabChange(tip: number): void {
    this.activeTab.set(tip);
    this.loadRows();
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.loadRows();
  }

  setPeriod(p: Period): void {
    if (this.period() === p) return;
    this.period.set(p);
    this.selectedDate.set(new Date());
    this.loadRows();
  }

  prevPeriod(): void {
    this.shiftPeriod(-1);
  }

  nextPeriod(): void {
    this.shiftPeriod(1);
  }

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

  goToday(): void {
    this.selectedDate.set(new Date());
    this.loadRows();
  }

  openLeaveIconDialog(row: StudentAttendanceRow): void {
    this.selectedLeaveRow.set(row);
    this.leaveIconDialogVisible.set(true);
  }

  openAssignLeaveDialog(): void {
    const targets = this.selectedRows().map((r) => ({
      id: r.sicilId,
      adSoyad: r.adSoyad,
    }));
    this.assignLeaveTargets.set(targets);
    this.assignLeaveDialogVisible.set(true);
  }

  openEditLeaveDialog(): void {
    const row = this.selectedLeaveRow();
    if (!row?.izinId) return;
    this.editLeaveTargets.set([{ id: row.sicilId, adSoyad: row.adSoyad }]);
    this.editLeaveId.set(row.izinId);
    this.leaveIconDialogVisible.set(false);
    this.editLeaveDialogVisible.set(true);
  }

  onLeaveConfirmed(message: string): void {
    this.notification.success(message);
    this.selectedRows.set([]);
    this.loadRows();
  }

  deleteLeave(izinId: number): void {
    this.attendanceService
      .deleteStudentLeave(izinId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success('STUDENT_ATTENDANCE.MSG_LEAVE_DELETED');
          this.leaveIconDialogVisible.set(false);
          this.selectedRows.set([]);
          this.loadRows();
        },
        error: (err) => {
          console.error('İzin silme hatası:', err);
          this.notification.error('STUDENT_ATTENDANCE.MSG_LEAVE_DELETE_ERROR');
        },
      });
  }

  bulkDeleteLeaves(): void {
    const ids = this.selectedLeaveIds();
    if (ids.length === 0) return;

    this.confirmationService.confirm({
      message: this.translate.instant('STUDENT_ATTENDANCE.BULK_DELETE_CONFIRM_MESSAGE', {
        count: ids.length,
      }),
      header: this.translate.instant('STUDENT_ATTENDANCE.BULK_DELETE_CONFIRM_TITLE'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.CONFIRM'),
      rejectLabel: this.translate.instant('COMMON.CANCEL'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.executeBulkDelete(ids),
    });
  }

  private executeBulkDelete(ids: number[]): void {
    this.attendanceService
      .deleteStudentLeave(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const result = unwrapResponse<Record<string, unknown>>(
            res as Record<string, unknown> | null | undefined,
          );
          if (result && String(result['Sonuc'] ?? '') === '1') {
            this.notification.success('STUDENT_ATTENDANCE.MSG_LEAVE_DELETED');
            this.selectedRows.set([]);
            this.loadRows();
          } else {
            this.notification.error('STUDENT_ATTENDANCE.MSG_LEAVE_DELETE_ERROR');
          }
        },
        error: (err) => {
          console.error('Toplu izin silme hatası:', err);
          this.notification.error('STUDENT_ATTENDANCE.MSG_LEAVE_DELETE_ERROR');
        },
      });
  }
}
