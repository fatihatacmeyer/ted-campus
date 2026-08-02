import { Component, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
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
import { ActivityInterface } from '../../../../core/models/activity.model';
import { ActivityService } from '../../services/activity.service';
import { formatDate, parseDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
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
  private destroyRef = inject(DestroyRef);

  activities = signal<ActivityInterface[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);
  isDialogVisible = signal(false);
  editingActivity = signal<ActivityInterface | null>(null);
  showAllClassesConfirm = signal(false);
  pendingSaveData = signal<ActivityInterface | null>(null);

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

  statusOptions = [
    { label: 'Aktif', value: 'Aktif' },
    { label: 'Pasif', value: 'Pasif' },
    { label: 'İptal', value: 'İptal' },
  ];

  typeOptions = [
    { label: 'Gezi', value: 'Gezi' },
    { label: 'Sosyal Etkinlik', value: 'Sosyal Etkinlik' },
    { label: 'Eğitim / Seminer', value: 'Eğitim / Seminer' },
    { label: 'Mezuniyet', value: 'Mezuniyet' },
  ];

  // Sınıf seçenekleri — hierarchy (ortaokul 1-8)
  classroomGroups = [
    {
      label: '1. Sınıflar',
      items: [
        { label: '1-A', value: '1-A' },
        { label: '1-B', value: '1-B' },
      ],
    },
    {
      label: '2. Sınıflar',
      items: [
        { label: '2-A', value: '2-A' },
        { label: '2-B', value: '2-B' },
      ],
    },
    {
      label: '3. Sınıflar',
      items: [
        { label: '3-A', value: '3-A' },
        { label: '3-B', value: '3-B' },
      ],
    },
    {
      label: '4. Sınıflar',
      items: [
        { label: '4-A', value: '4-A' },
        { label: '4-B', value: '4-B' },
      ],
    },
    {
      label: '5. Sınıflar',
      items: [
        { label: '5-A', value: '5-A' },
        { label: '5-B', value: '5-B' },
      ],
    },
    {
      label: '6. Sınıflar',
      items: [
        { label: '6-A', value: '6-A' },
        { label: '6-B', value: '6-B' },
      ],
    },
    {
      label: '7. Sınıflar',
      items: [
        { label: '7-A', value: '7-A' },
        { label: '7-B', value: '7-B' },
      ],
    },
    {
      label: '8. Sınıflar',
      items: [
        { label: '8-A', value: '8-A' },
        { label: '8-B', value: '8-B' },
      ],
    },
  ];

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

    const payload = {
      ...formValues,
      isPrivate,
      classroom: classroomStr,
      fee: formValues.isPaid ? formValues.fee : null,
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
