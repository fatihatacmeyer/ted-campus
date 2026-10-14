import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NotificationService } from '../../../../core/services/notification.service';
import {
  ColumnCellDirective,
  ColumnDef,
  CustomizableTableComponent,
  uniqueFilterOptions,
} from '../../../../shared/components/customizable-table/customizable-table';
import { BusDirection, StudentBusPlan } from '../../models/school-bus.model';
import { BusStoreService } from '../../services/bus-store.service';
import { SchoolBusService } from '../../services/school-bus.service';
import { boldText, injectI18nVersion } from '../../utils/transport.utils';

/** Planlar sekmesi: öğrenci servis planları (sp_ogrenciservisplancampus_s). */
@Component({
  selector: 'app-plans-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TagModule,
    TextareaModule,
    TooltipModule,
    CustomizableTableComponent,
    ColumnCellDirective,
  ],
  templateUrl: './plans-tab.html',
  styleUrl: './plans-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private busService = inject(SchoolBusService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private store = inject(BusStoreService);
  private i18nVersion = injectI18nVersion();

  protected readonly studentBusPlans = signal<StudentBusPlan[]>([]);
  protected readonly studentBusPlansLoading = signal(false);

  /** Ekle/düzenle formu ve silme onayı. */
  protected readonly planFormVisible = signal(false);
  protected readonly planEditing = signal<StudentBusPlan | null>(null);
  protected readonly planDeleteVisible = signal(false);
  protected readonly planDeleting = signal<StudentBusPlan | null>(null);
  protected readonly planSaving = signal(false);

  /** Toplu silme: tabloda işaretlenen planlar ve onay penceresi. */
  protected readonly selectedPlans = signal<StudentBusPlan[]>([]);
  protected readonly planBulkDeleteVisible = signal(false);
  protected readonly planBulkDeleting = signal(false);

  /** busId 0 = "servis kullanmıyor"; direction ve weekday çoklu seçimdir (dizi). */
  protected readonly planForm: FormGroup = this.fb.group({
    studentId: [null, Validators.required],
    busId: [0, Validators.required],
    direction: [[1] as number[], Validators.required],
    repeatType: ['weekly', Validators.required],
    date: [''],
    weekday: [[] as number[]],
    startDate: [''],
    endDate: [''],
    description: [''],
    isActive: [true],
  });

  protected readonly studentBusPlanColumns: ColumnDef<StudentBusPlan>[] = [
    {
      field: 'ogrenciAdSoyad',
      header: 'SCHOOL_BUS.COL_STUDENT',
      sortable: true,
      alwaysVisible: true,
    },
    {
      field: 'sinif',
      header: 'SCHOOL_BUS.COL_CLASS',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'sinif'),
    },
    {
      field: 'kampus',
      header: 'SCHOOL_BUS.COL_CAMPUS',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'kampus'),
    },
    { field: 'plaka', header: 'SCHOOL_BUS.COL_PLATE', sortable: true },
    {
      field: 'yonAciklama',
      header: 'SCHOOL_BUS.DIRECTION',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'yonAciklama'),
    },
    {
      field: 'tekrarTuru',
      header: 'SCHOOL_BUS.COL_REPEAT',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'tekrarTuru'),
    },
    { field: 'gunAciklama', header: 'SCHOOL_BUS.COL_PLAN_DAY', sortable: true },
    { field: 'baslangicTarih', header: 'SCHOOL_BUS.COL_START_DATE', sortable: true },
    { field: 'bitisTarih', header: 'SCHOOL_BUS.COL_END_DATE', sortable: true },
    { field: 'isActive', header: 'SCHOOL_BUS.COL_STATUS', sortable: true, filterable: false },
    { field: 'aciklama', header: 'SCHOOL_BUS.COL_DESCRIPTION' },
    { field: 'olusturanAdSoyad', header: 'SCHOOL_BUS.COL_CREATED_BY', sortable: true },
    { field: 'olusturmaTarihi', header: 'SCHOOL_BUS.COL_CREATED_DATE', sortable: true },
    { field: 'guncelleyenAdSoyad', header: 'SCHOOL_BUS.COL_UPDATED_BY', sortable: true },
    { field: 'guncellemeTarihi', header: 'SCHOOL_BUS.COL_UPDATED_DATE', sortable: true },
  ];

  protected readonly studentOptions = computed(() =>
    this.store.students().map((s) => ({
      label: s.bolumad ? `${s.adsoyad} — ${s.bolumad}` : s.adsoyad,
      value: s.id,
    })),
  );

  /** Plan yönleri (çoklu seçim: ikisi birden seçilirse her yön ayrı kayıt olur). */
  protected readonly planDirectionOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_DEPARTURE'), value: 1 },
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_RETURN'), value: 2 },
    ];
  });

  protected readonly planRepeatOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.REPEAT_WEEKLY'), value: 'weekly' },
      { label: this.translate.instant('SCHOOL_BUS.REPEAT_SINGLE'), value: 'single' },
    ];
  });

  protected readonly planWeekdayOptions = computed(() => {
    this.i18nVersion();
    return [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      label: this.translate.instant(`SCHOOL_BUS.WEEKDAY_${day}`),
      value: day,
    }));
  });

  protected readonly planBusOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.NOT_USING_SERVICE'), value: 0 },
      ...this.store.buses().map((b) => ({
        label: `${b.plate} — ${b.brand} ${b.model}`,
        value: b.id,
      })),
    ];
  });

  protected readonly planActiveOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.STATUS_ACTIVE'), value: true },
      { label: this.translate.instant('SCHOOL_BUS.STATUS_PASSIVE'), value: false },
    ];
  });

  protected readonly bold = boldText;

  ngOnInit(): void {
    this.store.ensureBuses();
    this.loadStudentBusPlans();

    this.planForm
      .get('repeatType')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyPlanRepeatValidators());
  }

  /** Tek günlükte tarih, haftalıkta hafta günü zorunlu. */
  private applyPlanRepeatValidators(): void {
    const single = this.planForm.get('repeatType')?.value === 'single';
    const date = this.planForm.get('date')!;
    const weekday = this.planForm.get('weekday')!;
    date.setValidators(single ? Validators.required : null);
    weekday.setValidators(single ? null : Validators.required);
    date.updateValueAndValidity({ emitEvent: false });
    weekday.updateValueAndValidity({ emitEvent: false });
  }

  protected planIsSingle(): boolean {
    return this.planForm.get('repeatType')?.value === 'single';
  }

  /** Haftalık planda bitiş, başlangıçtan önce olamaz (yyyy-MM-dd metin karşılaştırması yeterli). */
  protected planDateRangeInvalid(): boolean {
    if (this.planIsSingle()) return false;
    const { startDate, endDate } = this.planForm.value;
    return !!startDate && !!endDate && endDate < startDate;
  }

  protected openPlanForm(plan?: StudentBusPlan): void {
    this.planEditing.set(plan ?? null);
    this.store.ensureStudents();

    const studentControl = this.planForm.get('studentId')!;
    if (plan) {
      studentControl.disable();
      this.planForm.reset({
        studentId: plan.ogrenciSicilId,
        busId: plan.servisId ?? 0,
        direction: [plan.yon],
        repeatType: plan.tarih ? 'single' : 'weekly',
        date: plan.tarih ?? '',
        weekday: plan.haftaGunu ? [plan.haftaGunu] : [],
        startDate: plan.baslangicIso ?? '',
        endDate: plan.bitisIso ?? '',
        description: plan.aciklama ?? '',
        isActive: plan.isActive,
      });
    } else {
      studentControl.enable();
      this.planForm.reset({
        studentId: null,
        busId: 0,
        direction: [1],
        repeatType: 'weekly',
        date: '',
        weekday: [],
        startDate: '',
        endDate: '',
        description: '',
        isActive: true,
      });
    }
    this.applyPlanRepeatValidators();
    this.planFormVisible.set(true);
  }

  protected closePlanForm(): void {
    if (this.planSaving()) return;
    this.planFormVisible.set(false);
    this.planEditing.set(null);
  }

  protected submitPlan(): void {
    if (this.planSaving()) return;
    if (this.planForm.invalid || this.planDateRangeInvalid()) {
      this.planForm.markAllAsTouched();
      return;
    }

    const v = this.planForm.getRawValue();
    const single = v.repeatType === 'single';
    const base = {
      servisId: v.busId || null,
      tarih: single ? v.date || null : null,
      haftaGunu: single ? [] : [...(v.weekday as number[])].sort((a, b) => a - b),
      baslangicTarih: single ? null : v.startDate || null,
      bitisTarih: single ? null : v.endDate || null,
      aciklama: (v.description ?? '').trim() || null,
      yon: [...(v.direction as BusDirection[])].sort((a, b) => a - b),
    };

    const editing = this.planEditing();
    const request$ = editing
      ? this.busService.updateStudentBusPlan(editing.id, { ...base, isActive: v.isActive })
      : this.busService.addStudentBusPlan(v.studentId, base);

    this.planSaving.set(true);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.planSaving.set(false);
        if (result.sonuc === 1) {
          // Prosedür tek işlemde çalışır; yalnızca başarıda liste değişir.
          this.loadStudentBusPlans();
          this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_OP_SUCCESS');
          this.closePlanForm();
        } else {
          this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_OP_ERROR');
        }
      },
      error: () => {
        this.planSaving.set(false);
        this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR');
      },
    });
  }

  protected confirmPlanDelete(plan: StudentBusPlan): void {
    this.planDeleting.set(plan);
    this.planDeleteVisible.set(true);
  }

  protected closePlanDelete(): void {
    this.planDeleteVisible.set(false);
    this.planDeleting.set(null);
  }

  protected confirmPlanBulkDelete(): void {
    if (this.selectedPlans().length === 0) return;
    this.planBulkDeleteVisible.set(true);
  }

  protected closePlanBulkDelete(): void {
    if (this.planBulkDeleting()) return;
    this.planBulkDeleteVisible.set(false);
  }

  /**
   * Seçili planları siler. Silme prosedürü tek kayıt aldığı için her plan ayrı
   * istek olarak gider (atomik değil); başarısız olanlar sayılıp özetlenir.
   */
  protected deleteSelectedPlans(): void {
    const targets = this.selectedPlans();
    if (targets.length === 0 || this.planBulkDeleting()) return;

    this.planBulkDeleting.set(true);
    forkJoin(
      targets.map((plan) =>
        this.busService
          .deleteStudentBusPlan(plan.id)
          .pipe(
            catchError(() =>
              of({ sonuc: -1, sunucuCevap: this.translate.instant('SCHOOL_BUS.MSG_SERVER_ERROR') }),
            ),
          ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        this.planBulkDeleting.set(false);
        this.planBulkDeleteVisible.set(false);
        const failed = results.filter((r) => r.sonuc !== 1);
        const deleted = results.length - failed.length;

        if (deleted > 0) {
          this.notification.success(
            this.translate.instant('SCHOOL_BUS.MSG_PLANS_DELETED', { count: deleted }),
          );
        }
        if (failed.length > 0) {
          this.notification.error(
            this.translate.instant('SCHOOL_BUS.MSG_PLANS_DELETE_FAILED', {
              count: failed.length,
              reason: failed[0].sunucuCevap,
            }),
          );
        }
        this.loadStudentBusPlans();
      });
  }

  protected deletePlan(): void {
    const target = this.planDeleting();
    if (!target) return;

    this.busService
      .deleteStudentBusPlan(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_OP_SUCCESS');
            this.loadStudentBusPlans();
            this.closePlanDelete();
          } else {
            this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_OP_ERROR');
          }
        },
        error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR'),
      });
  }

  private loadStudentBusPlans(): void {
    this.studentBusPlansLoading.set(true);
    this.busService
      .getStudentBusPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.studentBusPlans.set(rows);
          // Satır nesneleri yenilendiği için eski seçim (referans) geçersiz.
          this.selectedPlans.set([]);
          this.studentBusPlansLoading.set(false);
        },
        error: () => {
          this.notification.error('SCHOOL_BUS.MSG_PLANS_ERROR');
          this.studentBusPlansLoading.set(false);
        },
      });
  }
}
