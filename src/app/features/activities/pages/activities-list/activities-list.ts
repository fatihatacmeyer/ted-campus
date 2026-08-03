import { Component, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
  FilterOption,
  uniqueFilterOptions,
} from '../../../../shared/components/customizable-table/customizable-table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DropdownItem, TypesService } from '../../../persons/services/types.service';
import { ActivityInterface } from '../../../../core/models/activity.model';
import { ActivityService } from '../../services/activity.service';
import { formatDate, parseDate } from '../../../../shared/utils/date.utils';

/** Boole sütun filtreleri için Evet/Hayır seçenekleri */
const BOOLEAN_FILTER_OPTIONS: FilterOption[] = [
  { label: 'Evet', value: true },
  { label: 'Hayır', value: false },
];

@Component({
  selector: 'app-activities',
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
    CheckboxModule,
    MultiSelectModule,
    TooltipModule,
  ],
  templateUrl: './activities-list.html',
  styleUrls: ['./activities-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitiesComponent {
  private fb = inject(FormBuilder);
  private activityService = inject(ActivityService);
  private typesService = inject(TypesService);
  private destroyRef = inject(DestroyRef);

  activities = signal<ActivityInterface[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);
  isDialogVisible = signal(false);
  editingActivity = signal<ActivityInterface | null>(null);
  showAllClassesConfirm = signal(false);
  pendingSaveData = signal<ActivityInterface | null>(null);

  activityColumns: ColumnDef<ActivityInterface>[] = [
    { field: 'id', header: 'ID', sortable: true, width: '70px' },
    { field: 'name', header: 'Etkinlik Adı', sortable: true },
    {
      field: 'activityType',
      header: 'Türü',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'activityType'),
    },
    { field: 'startDate', header: 'Tarih', sortable: true, width: '110px' },
    { field: 'endDate', header: 'Bitiş Tarihi', sortable: true, width: '110px' },
    { field: 'eventManager', header: 'Yönetici' },
    { field: 'classroom', header: 'Sınıf / Kapsam' },
    {
      field: 'status',
      header: 'Durum',
      sortable: true,
      width: '100px',
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'status'),
    },
    { field: 'requestStartDate', header: 'Başvuru Başlangıcı', sortable: true, width: '130px' },
    { field: 'requestEndDate', header: 'Başvuru Bitişi', sortable: true, width: '130px' },
    { field: 'maxStudentCount', header: 'Max Öğrenci', sortable: true },
    { field: 'studentParentCount', header: 'Veli Sayısı' },
    {
      field: 'isPaid',
      header: 'Ücretli',
      filterType: 'select',
      filterOptions: BOOLEAN_FILTER_OPTIONS,
    },
    { field: 'fee', header: 'Ücret' },
    {
      field: 'isParentRequired',
      header: 'Veli Zorunlu',
      filterType: 'select',
      filterOptions: BOOLEAN_FILTER_OPTIONS,
    },
    { field: 'transportation', header: 'Ulaşım' },
    { field: 'description', header: 'Açıklama' },
    {
      field: 'isPrivate',
      header: 'Özel Etkinlik',
      filterType: 'select',
      filterOptions: BOOLEAN_FILTER_OPTIONS,
    },
    { field: 'createdAt', header: 'Oluşturulma Tarihi' },
  ];
  defaultActivityFields = [
    'id',
    'name',
    'activityType',
    'startDate',
    'eventManager',
    'classroom',
    'status',
  ];

  activityForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    activityType: ['', Validators.required],
    status: ['Aktif', Validators.required],
    startDate: [null, Validators.required],
    endDate: [null, Validators.required],
    requestStartDate: [null],
    requestEndDate: [null],
    maxStudentCount: [0, Validators.min(1)],
    isParentRequired: [false],
    studentParentCount: [0],
    isPaid: [false],
    fee: [{ value: null, disabled: true }],
    transportation: [''],
    educationLevel: [''],
    eventManager: [''],
    description: [''],
    classroom: [[]],
  });

  constructor() {
    this.activityForm
      .get('isPaid')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paid) => {
        const feeCtrl = this.activityForm.get('fee');
        if (paid) {
          feeCtrl!.enable();
        } else {
          feeCtrl!.disable();
          feeCtrl!.setValue(null);
        }
      });

    this.loadActivities();
    this.loadDropdownData();
  }

  /** sp_etkinlikcampus_s'ten gerçek listeyi çeker. */
  loadActivities(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.activityService
      .getActivities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.activities.set(list);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[ActivitiesComponent] loadActivities error:', err);
          this.errorMessage.set('Etkinlikler yüklenirken bir hata oluştu.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Dropdown verilerini backend lookup prosedürlerinden çeker:
   * TurCampus (etkinlik türü), UlasimCampus (ulaşım), cbo_bolum (sınıflar),
   * cbo_direktorluk (eğitim düzeyi).
   */
  private loadDropdownData(): void {
    forkJoin({
      TurCampus: this.typesService.getDropdownList('TurCampus').pipe(
        catchError((err) => {
          console.error('Etkinlik türleri yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      UlasimCampus: this.typesService.getDropdownList('UlasimCampus').pipe(
        catchError((err) => {
          console.error('Ulaşım bilgileri yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_bolum: this.typesService.getDropdownList('cbo_bolum').pipe(
        catchError((err) => {
          console.error('Sınıflar yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_direktorluk: this.typesService.getDropdownList('cbo_direktorluk').pipe(
        catchError((err) => {
          console.error('Eğitim düzeyleri yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ TurCampus, UlasimCampus, cbo_bolum, cbo_direktorluk }) => {
        this.typeOptions = TurCampus;
        this.transportationOptions = UlasimCampus;
        this.classroomOptions = cbo_bolum;
        this.classroomGroups = this.buildClassroomGroups(cbo_bolum);
        this.educationLevelOptions = cbo_direktorluk;
      });
  }

  /**
   * cbo_bolum'den gelen düz sınıf listesini grade gruplarına böler
   * (örn. "1-A" → "1. Sınıflar"). Rakamla başlamayan ad'lar "Diğer" grubuna düşer.
   */
  private buildClassroomGroups(
    items: DropdownItem[],
  ): { label: string; items: { label: string; value: string }[] }[] {
    const groups = new Map<string, { label: string; value: string }[]>();
    for (const item of items) {
      const gradeMatch = item.ad.trim().match(/^(\d+)/);
      const groupLabel = gradeMatch ? `${gradeMatch[1]}. Sınıflar` : 'Diğer';
      if (!groups.has(groupLabel)) {
        groups.set(groupLabel, []);
      }
      groups.get(groupLabel)!.push({ label: item.ad, value: item.ad });
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        const na = Number.parseInt(a, 10);
        const nb = Number.parseInt(b, 10);
        if (Number.isNaN(na)) return 1;
        if (Number.isNaN(nb)) return -1;
        return na - nb;
      })
      .map(([label, items]) => ({ label, items }));
  }

  statusOptions = [
    { label: 'Aktif', value: 'Aktif' },
    { label: 'Pasif', value: 'Pasif' },
    { label: 'İptal', value: 'İptal' },
  ];

  /** Etkinlik türleri — TurCampus lookup'undan doldurulur. */
  typeOptions: DropdownItem[] = [];

  /** Ulaşım bilgileri — UlasimCampus lookup'undan doldurulur. */
  transportationOptions: DropdownItem[] = [];

  /** Eğitim düzeyleri — cbo_direktorluk lookup'undan doldurulur. */
  educationLevelOptions: DropdownItem[] = [];

  /** Ham sınıf listesi — cbo_bolum lookup'undan doldurulur. */
  classroomOptions: DropdownItem[] = [];

  // Sınıf seçenekleri — cbo_bolum'den gelen veriden türetilen grade grupları (1. Sınıflar, 2. Sınıflar...)
  classroomGroups: { label: string; items: { label: string; value: string }[] }[] = [];

  /** Grubun tüm şubeleri seçili mi? */
  isGroupSelected(group: { label: string; items: { label: string; value: string }[] }): boolean {
    const selected: string[] = this.activityForm.get('classroom')?.value || [];
    return group.items.length > 0 && group.items.every((item) => selected.includes(item.value));
  }

  /** Grup içinde kaç şube seçili? */
  getGroupSelectedCount(group: {
    label: string;
    items: { label: string; value: string }[];
  }): number {
    const selected: string[] = this.activityForm.get('classroom')?.value || [];
    return group.items.filter((item) => selected.includes(item.value)).length;
  }

  /** Tüm sınıflar seçili mi? */
  get isAllClassesSelected(): boolean {
    if (this.allClassesCount === 0) return false;
    const selected: string[] = this.activityForm.get('classroom')?.value || [];
    return selected.length === this.allClassesCount;
  }

  /** Toplam sınıf sayısı */
  get allClassesCount(): number {
    return this.classroomGroups.reduce((sum, group) => sum + group.items.length, 0);
  }

  /** Tüm sınıfları seç */
  selectAllClasses(): void {
    const allValues = this.classroomGroups.flatMap((g) => g.items.map((i) => i.value));
    this.activityForm.get('classroom')!.setValue(allValues);
  }

  /** Seçimi temizle */
  clearAllClasses(): void {
    this.activityForm.get('classroom')!.setValue([]);
  }

  /** Tüm sınıflar toggle */
  toggleAllClasses(): void {
    if (this.isAllClassesSelected) {
      this.clearAllClasses();
    } else {
      this.selectAllClasses();
    }
  }

  /** Seçim özeti string */
  get getSelectionSummary(): string {
    const selected: string[] = this.activityForm.get('classroom')?.value || [];
    if (selected.length === 0) return '';
    if (this.isAllClassesSelected) {
      return `Tüm sınıflar seçili (${this.allClassesCount} şube)`;
    }

    const parts: string[] = [];
    for (const group of this.classroomGroups) {
      const count = group.items.filter((item) => selected.includes(item.value)).length;
      if (count > 0) {
        parts.push(`${group.label} (${count}/${group.items.length})`);
      }
    }
    return parts.join(', ');
  }

  /** Sınıf değerinden (ör: "2-A") grade etiketini (ör: "2. Sınıf") döndür */
  getGradeLabelForClass(classValue: string): string {
    for (const group of this.classroomGroups) {
      if (group.items.some((item) => item.value === classValue)) {
        return group.label.replace('lar', '').replace('ler', '');
      }
    }
    return '';
  }

  /** Tablodaki sınıf hücresi için gruplanmış özet string */
  getTableClassroomSummary(classroom: string): string {
    if (!classroom || classroom === 'Tüm Sınıflar') return 'Tüm Sınıflar';

    const classes = classroom.split(', ');
    const counts = new Map<string, number>();

    for (const cls of classes) {
      const gradeLabel = this.getGradeLabelForClass(cls);
      if (gradeLabel) {
        counts.set(gradeLabel, (counts.get(gradeLabel) || 0) + 1);
      }
    }

    if (counts.size === 0) return classroom;
    return Array.from(counts.entries())
      .map(([label, count]) => `${label}: ${count}`)
      .join(', ');
  }

  /** Tablodaki tooltip için tam liste */
  getTableClassroomFull(classroom: string): string {
    if (!classroom || classroom === 'Tüm Sınıflar') return 'Tüm Sınıflar';
    return classroom;
  }

  /** Grubu aç/kapat: hepsi seçiliyse kaldır, değilse hepsini ekle */
  toggleGroup(group: { label: string; items: { label: string; value: string }[] }): void {
    const ctrl = this.activityForm.get('classroom')!;
    const current: string[] = ctrl.value || [];
    const groupValues = new Set(group.items.map((i) => i.value));

    if (this.isGroupSelected(group)) {
      // Tümünü kaldır
      ctrl.setValue(current.filter((v) => !groupValues.has(v)));
    } else {
      // Tümünü ekle
      const merged = [...new Set([...current, ...group.items.map((i) => i.value)])];
      ctrl.setValue(merged);
    }
  }

  get dialogTitle(): string {
    return this.editingActivity() ? 'Etkinlik Düzenle' : 'Yeni Etkinlik Ekle';
  }

  openAddDialog() {
    this.editingActivity.set(null);
    this.activityForm.reset({
      status: 'Aktif',
      isPaid: false,
      isParentRequired: false,
      maxStudentCount: 0,
      studentParentCount: 0,
      classroom: [],
    });
    this.isDialogVisible.set(true);
  }

  openEditDialog(activity: ActivityInterface) {
    this.editingActivity.set(activity);

    // Sınıfları string'den diziye (array) çeviriyoruz
    const classArray =
      activity.classroom && activity.classroom !== 'Tüm Sınıflar'
        ? activity.classroom.split(', ')
        : [];

    this.activityForm.patchValue({
      ...activity,
      classroom: classArray,
      startDate: parseDate(activity.startDate),
      endDate: parseDate(activity.endDate),
      requestStartDate: parseDate(activity.requestStartDate),
      requestEndDate: parseDate(activity.requestEndDate),
    });
    this.isDialogVisible.set(true);
  }

  closeDialog() {
    this.isDialogVisible.set(false);
    this.editingActivity.set(null);
    this.activityForm.reset();
  }

  saveActivity() {
    if (this.activityForm.invalid) {
      this.activityForm.markAllAsTouched();
      return;
    }

    const formValues = this.activityForm.getRawValue();

    // Sınıf dizisine göre classroom string ve isPrivate türet
    const hasClassroom = Array.isArray(formValues.classroom) && formValues.classroom.length > 0;
    const classroomStr = hasClassroom ? formValues.classroom.join(', ') : 'Tüm Sınıflar';
    const isPrivate = hasClassroom;

    // Seçilen ad'lardan FK id'lerini lookup ile türet (yazma SP'leri Id bekliyor)
    const selectedType = this.typeOptions.find((o) => o.ad === formValues.activityType);
    const selectedTransportation = this.transportationOptions.find(
      (o) => o.ad === formValues.transportation,
    );
    const selectedClasses = this.classroomOptions.filter((o) =>
      (formValues.classroom as string[]).includes(o.ad),
    );
    const selectedEducationLevel = this.educationLevelOptions.find(
      (o) => o.ad === formValues.educationLevel,
    );

    const payload = {
      ...formValues,
      isPrivate,
      classroom: classroomStr,
      fee: formValues.isPaid ? formValues.fee : null,
      turId: selectedType?.id ?? '',
      ulasimId: selectedTransportation?.id ?? '',
      sinifId: selectedClasses.map((c) => c.id).join(';'),
      egitimDuzeyiId: selectedEducationLevel?.id ?? '',
      oKod1: '',
      oKod2: '',
      oKod3: '',
      oKod4: '',
      oKod5: '',
      startDate: formatDate(formValues.startDate),
      endDate: formatDate(formValues.endDate),
      requestStartDate: formatDate(formValues.requestStartDate),
      requestEndDate: formatDate(formValues.requestEndDate),
    };

    if (!hasClassroom) {
      this.showAllClassesConfirm.set(true);
      this.pendingSaveData.set(payload);
      return;
    }

    this.executeSave(payload);
  }

  private executeSave(payload: ActivityInterface) {
    const currentActivity = this.editingActivity();
    this.isSaving.set(true);
    this.errorMessage.set(null);

    const request = currentActivity
      ? this.activityService.updateActivity(currentActivity.id, { ...payload })
      : this.activityService.addActivity({ ...payload });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeDialog();
        this.loadActivities(); // sunucudaki güncel/otoriter listeyi tekrar çek
      },
      error: (err) => {
        console.error('[ActivitiesComponent] save error:', err);
        this.errorMessage.set('Etkinlik kaydedilirken bir hata oluştu.');
        this.isSaving.set(false);
      },
    });
  }

  confirmSave() {
    const data = this.pendingSaveData();
    if (!data) return;

    this.executeSave(data);
    this.showAllClassesConfirm.set(false);
    this.pendingSaveData.set(null);
  }

  cancelConfirm() {
    this.showAllClassesConfirm.set(false);
    this.pendingSaveData.set(null);
  }

  deleteActivity(id: number) {
    if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) {
      return;
    }
    this.errorMessage.set(null);
    this.activityService
      .deleteActivity(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadActivities(),
        error: (err) => {
          console.error('[ActivitiesComponent] delete error:', err);
          this.errorMessage.set('Etkinlik silinirken bir hata oluştu.');
        },
      });
  }

  getSeverity(status: string) {
    switch (status) {
      case 'Aktif':
        return 'success';
      case 'Pasif':
        return 'warn';
      case 'İptal':
        return 'danger';
      default:
        return 'info';
    }
  }
}
