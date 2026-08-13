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
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { NotificationService } from '../../../../core/services/notification.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
  uniqueFilterOptions,
} from '../../../../shared/components/customizable-table/customizable-table';
import {
  AttendanceListType,
  AttendanceRow,
  LeaveBalance,
  LeaveRecord,
  LeaveRequest,
} from '../../../../core/models/attendance.model';
import { AttendanceService } from '../../services/attendance.service';
import { DropdownItem } from '../../../../features/persons/services/types.service';
import {
  computePeriodRange,
  formatDate,
  formatTime,
} from '../../../../shared/utils/date.utils';
import { TranslatePipe } from '@ngx-translate/core';

/** Period type: gün / hafta / ay. */
type Period = 'gun' | 'hafta' | 'ay';

/** Attendance list tabs: label and listType mapping (0=general, 6=on leave, 5=early leavers, 4=late arrivals). */
interface TabOption {
  label: string;
  tip: AttendanceListType;
}

@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CustomizableTableComponent,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    TooltipModule,
    CheckboxModule,
    TranslatePipe,
  ],
  templateUrl: './attendance-list.html',
  styleUrl: './attendance-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceListComponent {
  private fb = inject(FormBuilder);
  private attendanceService = inject(AttendanceService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  /** Attendance rows for the active tab + period range. */
  rows = signal<AttendanceRow[]>([]);
  isLoading = signal(false);

  /** Multiselect ile seçilen satırlar. */
  selectedRows = signal<AttendanceRow[]>([]);

  /** Active list tab: 0=Genel, 6=İzinliler, 5=Erken Çıkanlar, 4=Geç Gelenler. */
  activeTab = signal<AttendanceListType>(0);

  /** Selected period type and date; range is computed from them. */
  period = signal<Period>('gun');
  selectedDate = signal<Date>(new Date());
  range = computed(() => computePeriodRange(this.period(), this.selectedDate()));

  /** Toolbar range label (dd-MM-yyyy - dd-MM-yyyy). */
  rangeLabel = computed(() => {
    const { baslangic, bitis } = this.range();
    return `${this.toDisplayDate(baslangic)} - ${this.toDisplayDate(bitis)}`;
  });

  /** Current user's leave requests (İzinlerim section). */
  leaves = signal<LeaveRecord[]>([]);
  leaveTypes = signal<DropdownItem[]>([]);
  leaveBalance = signal<LeaveBalance | null>(null);

  /** Leave request dialog state. */
  leaveDialogVisible = signal(false);
  selectedRow = signal<AttendanceRow | null>(null);
  hourlyLeave = signal(false);
  saving = signal(false);

  /** Leave cancel confirmation dialog state. */
  confirmCancelVisible = signal(false);
  confirmCancelRec = signal<LeaveRecord | null>(null);

  /** Fixed options for the tab buttons. */
  tabOptions: TabOption[] = [
    { label: 'ATTENDANCE.TAB_GENERAL', tip: 0 },
    { label: 'ATTENDANCE.TAB_ON_LEAVE', tip: 6 },
    { label: 'ATTENDANCE.TAB_EARLY_LEAVERS', tip: 5 },
    { label: 'ATTENDANCE.TAB_LATE_ARRIVALS', tip: 4 },
  ];

  /** Empty cell rendering (used in custom cells). */
  readonly emptyCellValue = '-';

  /** Time formatter exposed to the template. */
  readonly formatTime = formatTime;

  attendanceColumns: ColumnDef<AttendanceRow>[] = [
    {
      field: 'sicilNo',
      header: 'ATTENDANCE.COL_SICIL_NO',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'sicilNo'),
    },
    { field: 'adSoyad', header: 'ATTENDANCE.COL_AD_SOYAD', sortable: true, alwaysVisible: true },
    {
      field: 'bolumAd',
      header: 'ATTENDANCE.COL_BOLUM',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'bolumAd'),
    },
    { field: 'pozisyonAd', header: 'ATTENDANCE.COL_POZISYON', sortable: true },
    { field: 'mesaiTarih', header: 'ATTENDANCE.COL_MESAI_TARIH', sortable: true },
    { field: 'giris', header: 'ATTENDANCE.COL_GIRIS', sortable: true },
    { field: 'cikis', header: 'ATTENDANCE.COL_CIKIS', sortable: true },
    { field: 'gecKalma', header: 'ATTENDANCE.COL_GEC_KALMA', sortable: true },
    { field: 'erkenCikma', header: 'ATTENDANCE.COL_ERKEN_CIKMA', sortable: true },
    { field: 'izinSuresi', header: 'ATTENDANCE.COL_IZIN_SURESI', sortable: true },
    { field: 'mesaiSuresi', header: 'ATTENDANCE.COL_MESAI_SURESI', sortable: true },
    { field: 'mesaiAciklama', header: 'ATTENDANCE.COL_ACIKLAMA' },
  ];
  defaultAttendanceFields = [
    'sicilNo',
    'adSoyad',
    'bolumAd',
    'pozisyonAd',
    'mesaiTarih',
    'giris',
    'cikis',
    'gecKalma',
    'erkenCikma',
    'izinSuresi',
    'mesaiSuresi',
    'mesaiAciklama',
  ];

  leaveForm: FormGroup = this.fb.group({
    izintip: [null, Validators.required],
    kalan: [{ value: null, disabled: true }],
    baslangic: [null, Validators.required],
    bitis: [null, Validators.required],
    baslangicSaat: [''],
    bitisSaat: [''],
    saatlik: [false],
    adres: [''],
    aciklama: [''],
    ucretli: [false],
  });

  constructor() {
    this.leaveForm
      .get('saatlik')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.hourlyLeave.set(!!value));

    // Initial loads: leave types, general tab + today's range, my leaves.
    this.loadLeaveTypes();
    this.loadRows();
    this.loadLeaves();
  }

  /** Converts 'yyyy-MM-dd' to dd-MM-yyyy display format. */
  private toDisplayDate(dateStr: string): string {
    return dateStr.split('-').reverse().join('-');
  }

  /** Converts 'yyyy-MM-dd' to a Date in the local timezone. */
  private toDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /** Fetches attendance rows for the active tab and period range. */
  loadRows(): void {
    this.isLoading.set(true);
    const { baslangic, bitis } = this.range();
    this.attendanceService
      .getAttendanceRows({ listeTip: this.activeTab(), baslangic, bitis })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.rows.set(list ?? []);
          this.selectedRows.set([]);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[AttendanceListComponent] loadRows error:', err);
          this.rows.set([]);
          this.isLoading.set(false);
        },
      });
  }

  /** Applies tab change and refreshes the list. */
  onTabChange(tip: AttendanceListType): void {
    this.activeTab.set(tip);
    this.loadRows();
  }

  /** Handles multiselect changes from the table. */
  onSelectionChange(rows: AttendanceRow[]): void {
    this.selectedRows.set(rows);
  }

  /** Clears the multiselect selection. */
  clearSelection(): void {
    this.selectedRows.set([]);
  }

  /** Changes period type; resets the date to today and refreshes the list. */
  setPeriod(p: Period): void {
    if (this.period() === p) return;
    this.period.set(p);
    this.selectedDate.set(new Date());
    this.loadRows();
  }

  /** Steps one period back (day/week/month) and refreshes the list. */
  prevPeriod(): void {
    this.shiftPeriod(-1);
  }

  /** Steps one period forward (day/week/month) and refreshes the list. */
  nextPeriod(): void {
    this.shiftPeriod(1);
  }

  /** Shifts the date by the period unit (respecting month/year boundaries). */
  private shiftPeriod(delta: number): void {
    const current = this.selectedDate();
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    if (this.period() === 'gun') {
      next.setDate(next.getDate() + delta);
    } else if (this.period() === 'hafta') {
      next.setDate(next.getDate() + delta * 7);
    } else {
      next.setDate(1); // ay sonu taşmalarını önler
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

  /** Opens the leave request dialog and prefills the form with the row's shift date. */
  openLeaveDialog(row: AttendanceRow): void {
    this.selectedRow.set(row);
    this.leaveDialogVisible.set(true);
    this.leaveForm.reset({
      izintip: null,
      kalan: null,
      baslangic: this.toDate(row.mesaiTarih),
      bitis: this.toDate(row.mesaiTarih),
      baslangicSaat: '',
      bitisSaat: '',
      saatlik: false,
      adres: '',
      aciklama: '',
      ucretli: false,
    });
    this.loadLeaveFormData();
  }

  /** Closes the leave dialog and clears the selected row. */
  closeLeaveDialog(): void {
    this.leaveDialogVisible.set(false);
    this.selectedRow.set(null);
    this.saving.set(false);
  }

  /** Loads leave types and remaining balance for the dialog (empty on error). */
  private loadLeaveFormData(): void {
    forkJoin({
      tipler: this.attendanceService.getLeaveTypes().pipe(
        catchError((err) => {
          console.error('[AttendanceListComponent] izin tipleri hatası:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      hak: this.attendanceService.getLeaveBalance().pipe(
        catchError((err) => {
          console.error('[AttendanceListComponent] izin hakkı hatası:', err);
          return of(null as LeaveBalance | null);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ tipler, hak }) => {
        this.leaveTypes.set(tipler);
        this.leaveBalance.set(hak);
        this.leaveForm.get('kalan')?.setValue(hak?.kalan ?? null);
      });
  }

  /** Builds a LeaveRequest from the form, sends it and refreshes leaves on success. */
  saveLeave(): void {
    if (this.leaveForm.invalid) return;
    const f = this.leaveForm.getRawValue();
    const request: LeaveRequest = {
      izinTipId: f.izintip,
      sicilId: this.selectedRow()?.sicilId,
      baslangic: formatDate(f.baslangic),
      bitis: formatDate(f.bitis),
      baslangicSaat: f.saatlik ? f.baslangicSaat || null : null,
      bitisSaat: f.saatlik ? f.bitisSaat || null : null,
      ucretli: !!f.ucretli,
      saatlik: !!f.saatlik,
      adres: f.adres ?? '',
      aciklama: f.aciklama ?? '',
    };
    this.saving.set(true);
    this.attendanceService
      .requestLeave(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeLeaveDialog();
          this.loadLeaves();
          this.notification.success('NOTIFICATIONS.MESSAGES.LEAVE_ASSIGNED');
        },
        error: (err) => {
          console.error('[AttendanceListComponent] saveLeave error:', err);
          this.saving.set(false);
          this.notification.error('NOTIFICATIONS.MESSAGES.LEAVE_REQUEST_FAILED');
        },
      });
  }

  /** Fetches the current user's leave requests. */
  loadLeaves(): void {
    this.attendanceService
      .getMyLeaves()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.leaves.set(list ?? []),
        error: (err) => {
          console.error('[AttendanceListComponent] loadLeaves error:', err);
          this.leaves.set([]);
        },
      });
  }

  /** Opens the cancel confirmation dialog (signal-driven simple confirm). */
  cancelLeave(rec: LeaveRecord): void {
    this.confirmCancelRec.set(rec);
    this.confirmCancelVisible.set(true);
  }

  /** Closes the cancel confirmation dialog and clears the selected record. */
  closeCancelConfirm(): void {
    this.confirmCancelVisible.set(false);
    this.confirmCancelRec.set(null);
  }

  /** Sends the confirmed cancel request and refreshes the leave list. */
  confirmCancelLeave(): void {
    const rec = this.confirmCancelRec();
    if (!rec) return;
    this.attendanceService
      .cancelLeave(rec.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closeCancelConfirm();
          this.loadLeaves();
          this.notification.success('NOTIFICATIONS.MESSAGES.LEAVE_CANCELLED');
        },
        error: (err) => {
          console.error('[AttendanceListComponent] confirmCancelLeave error:', err);
          this.notification.error('NOTIFICATIONS.MESSAGES.LEAVE_CANCEL_FAILED');
        },
      });
  }

  /** Returns the p-tag severity based on leave status. */
  getLeaveSeverity(durum: string): 'success' | 'warn' | 'danger' {
    if (durum === 'Onaylandı') return 'success';
    if (durum === 'Reddedildi') return 'danger';
    return 'warn';
  }

  /** Maps a leave status data value to its i18n key (for rendered cell text). */
  getLeaveStatusLabel(durum: string): string {
    if (durum === 'Onaylandı') return 'ATTENDANCE.STATUS_APPROVED';
    if (durum === 'Reddedildi') return 'ATTENDANCE.STATUS_REJECTED';
    return 'ATTENDANCE.STATUS_PENDING';
  }

  /** Preloads the leave type dropdown on init. */
  private loadLeaveTypes(): void {
    this.attendanceService
      .getLeaveTypes()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          console.error('[AttendanceListComponent] izin tipleri hatası:', err);
          return of([] as DropdownItem[]);
        }),
      )
      .subscribe((list) => this.leaveTypes.set(list));
  }
}
