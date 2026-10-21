import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { ActivityInterface } from '../../../../core/models/activity.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatDateTime, parseDate } from '../../../../shared/utils/date.utils';
import { ActivityLookups } from '../../services/activity-lookups.service';
import { ActivityService } from '../../services/activity.service';
import { ClassScopePickerComponent } from '../class-scope-picker/class-scope-picker';

/** Cross-field: Bitiş tarihi başlangıç tarihinden küçük olamaz. */
function dateRangeValidator(startKey: string, endKey: string, errorKey: string) {
  return (group: FormGroup) => {
    const start = group.get(startKey)?.value;
    const end = group.get(endKey)?.value;
    if (!start || !end) return null;
    return new Date(end) >= new Date(start) ? null : { [errorKey]: true };
  };
}

/** Cross-field: isPaid true iken fee boş olamaz. */
function paidFeeValidator(group: FormGroup) {
  const isPaid = group.get('isPaid')?.value;
  const fee = group.get('fee')?.value;
  if (isPaid && (fee === null || fee === undefined || fee === '')) {
    return { feeRequired: true };
  }
  return null;
}

/** En az bir sınıf seçili olmalı. */
function minClassroomValidator(control: AbstractControl) {
  const val = control.value;
  if (Array.isArray(val) && val.length > 0) return null;
  return { minClassroom: true };
}

/**
 * Etkinlik ekle / düzenle diyaloğu ve "tüm sınıflar" onayı. Sayfa `openAdd()` / `openEdit()` ile
 * açar; kayıt başarılı olunca `saved` yayar (sayfa listeyi yeniler). Lookup listeleri sayfanın
 * sağladığı `ActivityLookups` servisinden gelir.
 */
@Component({
  selector: 'app-activity-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    ClassScopePickerComponent,
  ],
  templateUrl: './activity-form-dialog.html',
  styleUrl: './activity-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFormDialogComponent {
  private fb = inject(FormBuilder);
  private activityService = inject(ActivityService);
  private destroyRef = inject(DestroyRef);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  protected readonly lookups = inject(ActivityLookups);

  /** Kayıt (ekleme/güncelleme) başarıyla tamamlandı. */
  readonly saved = output<void>();

  isSaving = signal(false);
  formSubmitted = signal(false);
  isDialogVisible = signal(false);
  editingActivity = signal<ActivityInterface | null>(null);
  showAllClassesConfirm = signal(false);
  pendingSaveData = signal<ActivityInterface | null>(null);

  activityForm: FormGroup = this.fb.group(
    {
      name: ['', Validators.required],
      activityType: ['', Validators.required],
      status: ['Aktif', Validators.required],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      requestStartDate: [null, Validators.required],
      requestEndDate: [null, Validators.required],
      maxStudentCount: [null, [Validators.required, Validators.min(1)]],
      isParentRequired: [false],
      studentParentCount: [0],
      maxGuestPerParent: [null],
      isPaid: [false],
      fee: [{ value: null, disabled: true }],
      transportation: ['', Validators.required],
      educationLevel: [''],
      campus: [''],
      eventManager: [''],
      description: [''],
      classroom: [[], minClassroomValidator],
    },
    {
      validators: [
        dateRangeValidator('startDate', 'endDate', 'dateRange'),
        dateRangeValidator('requestStartDate', 'requestEndDate', 'dateRangeRequest'),
        paidFeeValidator,
      ],
    },
  );

  protected readonly classroomControl = this.activityForm.get('classroom') as FormControl<
    string[] | null
  >;

  constructor() {
    this.lookups.load();

    this.activityForm
      .get('isPaid')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paid) => {
        const feeCtrl = this.activityForm.get('fee');
        if (paid) {
          feeCtrl!.enable();
          feeCtrl!.setValidators([Validators.required]);
        } else {
          feeCtrl!.disable();
          feeCtrl!.clearValidators();
          feeCtrl!.setValue(null);
        }
        feeCtrl!.updateValueAndValidity();
        this.activityForm.updateValueAndValidity();
      });

    this.activityForm
      .get('isParentRequired')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((required) => {
        const ctrl = this.activityForm.get('studentParentCount');
        if (required) {
          ctrl!.setValidators([Validators.required, Validators.min(1)]);
        } else {
          ctrl!.clearValidators();
        }
        ctrl!.updateValueAndValidity();
      });
  }

  get dialogTitle(): string {
    return this.editingActivity()
      ? this.translate.instant('ACTIVITIES.EDIT')
      : this.translate.instant('ACTIVITIES.ADD');
  }

  isFieldInvalid(field: string): boolean {
    const ctrl = this.activityForm.get(field);
    return !!(ctrl && ctrl.touched && ctrl.invalid);
  }

  openAdd() {
    this.editingActivity.set(null);
    this.formSubmitted.set(false);
    this.activityForm.reset({
      status: 'Aktif',
      isPaid: false,
      isParentRequired: false,
      maxStudentCount: null,
      studentParentCount: 0,
      maxGuestPerParent: null,
      classroom: [],
      educationLevel: '',
      campus: '',
    });
    this.isDialogVisible.set(true);
  }

  openEdit(activity: ActivityInterface) {
    this.editingActivity.set(activity);
    this.formSubmitted.set(false);

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
    this.formSubmitted.set(false);
    this.activityForm.reset();
  }

  saveActivity() {
    if (this.activityForm.invalid) {
      this.formSubmitted.set(true);
      this.activityForm.markAllAsTouched();
      return;
    }

    const formValues = this.activityForm.getRawValue();

    // Sınıf dizisine göre classroom string ve isPrivate türet
    const hasClassroom = Array.isArray(formValues.classroom) && formValues.classroom.length > 0;
    const classroomStr = hasClassroom ? formValues.classroom.join(', ') : 'Tüm Sınıflar';
    const isPrivate = hasClassroom;

    // Seçilen ad'lardan FK id'lerini lookup ile türet (yazma SP'leri Id bekliyor)
    const classroomOptions = this.lookups.classrooms();
    const selectedType = this.lookups.types().find((o) => o.ad === formValues.activityType);
    const selectedTransportation = this.lookups
      .transportations()
      .find((o) => o.ad === formValues.transportation);
    const selectedClasses = classroomOptions.filter((o) =>
      (formValues.classroom as string[]).includes(o.ad),
    );
    // "Tüm Sınıflar" seçildiğinde (classroom boş) hiç sınıf id'si gönderilmiyordu;
    // bu yüzden SP'nin EtkinlikDurumCampus kayıtları hiç oluşmuyordu. Tüm sınıf
    // id'lerini ';' ile birleştirerek gönderiyoruz → tüm sınıflardaki öğrencilere
    // katılımcı kaydı oluşturulur.
    const classIdList = hasClassroom
      ? selectedClasses.map((c) => c.id)
      : classroomOptions.map((c) => c.id);
    const selectedEducationLevel = this.lookups
      .educationLevels()
      .find((o) => o.ad === formValues.educationLevel);
    const selectedCampus = this.lookups.campuses().find((o) => o.ad === formValues.campus);

    const payload = {
      ...formValues,
      isPrivate,
      classroom: classroomStr,
      fee: formValues.isPaid ? formValues.fee : null,
      turId: selectedType?.id ?? '',
      ulasimId: selectedTransportation?.id ?? '',
      // Edit'te lookup boşsa (sınıf silinmiş vb.) DB'den gelen orijinal SinifId korunur.
      sinifId:
        classIdList.length > 0 ? classIdList.join(';') : (this.editingActivity()?.sinifId ?? ''),
      egitimDuzeyiId: selectedEducationLevel?.id ?? '',
      campus: formValues.campus || '',
      campusId: selectedCampus?.id ?? this.editingActivity()?.campusId ?? '',
      firmaId: selectedCampus?.id ?? '',
      maxGuestPerParent: formValues.maxGuestPerParent ?? '',
      yasSiniri: this.editingActivity()?.yasSiniri ?? '',
      oKod1: '',
      oKod2: '',
      oKod3: '',
      oKod4: '',
      oKod5: '',
      startDate: formatDateTime(formValues.startDate),
      endDate: formatDateTime(formValues.endDate),
      requestStartDate: formatDateTime(formValues.requestStartDate),
      requestEndDate: formatDateTime(formValues.requestEndDate),
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

    const request = currentActivity
      ? this.activityService.updateActivity(currentActivity.id, { ...payload })
      : this.activityService.addActivity({ ...payload });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeDialog();
        this.saved.emit(); // sayfa sunucudaki güncel/otoriter listeyi tekrar çeker

        if (currentActivity) {
          this.notification.notifyUpdated();
        } else {
          this.notification.notifyAdded();
        }
      },
      error: (err) => {
        console.error('[ActivityFormDialog] save error:', err);
        this.notification.error('NOTIFICATIONS.MESSAGES.SAVE_FAILED');
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
}
