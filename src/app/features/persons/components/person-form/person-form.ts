import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  OnChanges,
  OnInit,
  inject,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { PersonService } from '../../services/person.service';
import { Person, UserDef, PersonInsertRequest } from '../../../../core/models/person.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatDate, parseDate } from '../../../../shared/utils/date.utils';
import {
  unwrapResponse,
  isSuccessResult,
  extractNewId,
} from '../../../../shared/utils/response.utils';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InputMaskModule } from 'primeng/inputmask';
import { PersonLinkedSectionComponent } from '../person-linked-section/person-linked-section';
import { linkedKindKey, linkedTargetUserdef } from '../../utils/linked-person.utils';
import { PersonFormOptions } from './person-form-options.service';

interface PersonFormFieldMeta {
  key: string;
  required?: boolean;
  isDate?: boolean;
  initValue?: unknown;
}

const PERSON_FORM_FIELDS: PersonFormFieldMeta[] = [
  { key: 'ad', required: true },
  { key: 'soyad', required: true },
  { key: 'dogumtarih', isDate: true },
  { key: 'cinsiyet', initValue: null },
  { key: 'kangrubu', initValue: null },
  { key: 'sicilno' },
  { key: 'personelno' },
  { key: 'cardid' },
  { key: 'ceptelefon' },
  { key: 'telefon1' },
  { key: 'email' },
  { key: 'adres' },
  { key: 'il' },
  { key: 'ilce' },
  { key: 'firma' },
  { key: 'bolum' },
  { key: 'pozisyon' },
  { key: 'gorev' },
  { key: 'altfirma' },
  { key: 'direktorluk' },
  { key: 'yaka' },
  { key: 'giristarih', isDate: true },
];

@Component({
  selector: 'app-person-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    DatePickerModule,
    SelectModule,
    TranslatePipe,
    InputMaskModule,
    PersonLinkedSectionComponent,
  ],
  providers: [PersonFormOptions],
  templateUrl: './person-form.html',
  styleUrl: './person-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonFormComponent implements OnChanges, OnInit {
  @Input() visible = false;
  @Input({ required: true }) userdef!: number;
  @Input() titleKey = 'PERSON.ADD_STUDENT';
  @Input() editPerson: Person | null = null;
  @Input() allPersons: Person[] = [];

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<unknown>();

  isEditMode = false;

  private fb = inject(FormBuilder);
  private personService = inject(PersonService);
  private cdr = inject(ChangeDetectorRef);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  protected readonly options = inject(PersonFormOptions);

  private readonly linked = viewChild(PersonLinkedSectionComponent);

  form: FormGroup = this.fb.group(this.buildFormControls());

  private buildFormControls(): Record<string, unknown> {
    const controls: Record<string, unknown> = {};
    for (const field of PERSON_FORM_FIELDS) {
      if (field.required) {
        controls[field.key] = ['', Validators.required];
      } else if (field.isDate) {
        controls[field.key] = [null as Date | null];
      } else {
        controls[field.key] = [field.initValue !== undefined ? field.initValue : ''];
      }
    }

    controls['linkedPersonId'] = [null];
    controls['yeniLinkedAd'] = [''];
    controls['yeniLinkedSoyad'] = [''];
    controls['yeniLinkedTelefon'] = [''];
    controls['changeLinkedId'] = [null];
    return controls;
  }

  get formConfig() {
    const isOgrenci = this.userdef === UserDef.Ogrenci;
    const isOgretmen = this.userdef === UserDef.Ogretmen;

    return {
      show: {
        personelno: true, //isOgrenci || isOgretmen,
        kurumsal: isOgrenci || isOgretmen,
        pozisyon: !isOgrenci,
        gorev: !isOgrenci,
      },
      labels: {
        sicilno: isOgrenci ? 'PERSON.SCHOOL_NO' : 'Sicil No',

        personelno: isOgretmen ? 'PERSON.PERSONNEL_NO' : 'PERSON.IDENTITY_DEFAULT',

        firma: 'PERSON.CAMPUS',
        direktorluk: isOgrenci ? 'PERSON.EDU_LEVEL' : 'PERSON.DIRECTORATE',
        bolum: isOgrenci ? 'PERSON.CLASS' : 'PERSON.DEPARTMENT',
        pozisyon: isOgretmen ? 'PERSON.BRANCH' : 'PERSON.POSITION',
        gorev: 'PERSON.TASK',
        altfirma: 'PERSON.SUB_CAMPUS',
      },
      placeholders: {
        sicilno: isOgrenci ? 'PERSON.SCHOOL_NO_PLACEHOLDER' : 'PERSON.IDENTITY_DEFAULT_PLACEHOLDER',

        personelno: isOgrenci
          ? 'PERSON.IDENTITY_STUDENT_PLACEHOLDER'
          : 'PERSON.PERSONNEL_NO_PLACEHOLDER',

        firma: 'PERSON.CAMPUS_PLACEHOLDER',
        direktorluk: isOgrenci ? 'PERSON.EDU_LEVEL_PLACEHOLDER' : 'PERSON.DIRECTORATE_PLACEHOLDER',
        bolum: isOgrenci ? 'PERSON.CLASS_PLACEHOLDER' : 'PERSON.DEPARTMENT_PLACEHOLDER',
        pozisyon: isOgretmen ? 'PERSON.BRANCH_PLACEHOLDER' : 'PERSON.POSITION_PLACEHOLDER',
        gorev: 'PERSON.TASK_PLACEHOLDER',
        altfirma: 'PERSON.SUB_CAMPUS_PLACEHOLDER',
      },
    };
  }

  isSaving = false;
  errorMessage = '';
  selectedPhoto: string | null = null;
  photoFileName = '';

  ngOnInit() {
    this.options.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editPerson']) {
      this.isEditMode = this.editPerson !== null;
      if (this.editPerson) this.patchFormForEdit();
    }
  }

  private patchFormForEdit(): void {
    const p = this.editPerson!;

    let cleanPhone = p.ceptelefon || '';
    cleanPhone = cleanPhone.replace(/\D/g, '');

    if (cleanPhone.startsWith('90') && cleanPhone.length >= 12) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }

    this.form.patchValue({
      ad: p.ad || '',
      soyad: p.soyad || '',
      dogumtarih: parseDate(p.dogumtarih ?? null),
      cinsiyet: this.options.toGenderId(p.cinsiyet),
      kangrubu: this.options.toBloodTypeId(p.kangrubu),
      sicilno: p.sicilno || '',
      personelno: p.personelno || '',
      cardid: p.cardid || '',
      ceptelefon: cleanPhone,
      telefon1: p.telefon1 || '',
      email: p.email || '',
      adres: p.adres || '',
      il: p.il || '',
      ilce: p.ilce || '',
      firma: p.firma || '',
      bolum: p.bolum || '',
      pozisyon: p.pozisyon || '',
      gorev: p.gorev || '',
      altfirma: p.altfirma || '',
      direktorluk: p.direktorluk || '',
      yaka: p.yaka || '',
      giristarih: parseDate(p.giristarih ?? null),
    });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.errorMessage = '';
    this.isSaving = false;
    this.isEditMode = false;
    this.selectedPhoto = null;
    this.photoFileName = '';
    this.linked()?.resetRelationState();
    this.form.reset();
    this.cdr.markForCheck();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;

    const file = input.files[0];
    this.photoFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.selectedPhoto = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.selectedPhoto = null;
    this.photoFileName = '';
  }

  get isRelationMode(): boolean {
    return this.userdef === UserDef.Ogrenci || this.userdef === UserDef.Veli;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    const formVals = this.form.value;
    const linked = this.linked();

    if (linked?.isCreatingNewLinked) {
      const kind = this.translate.instant(linkedKindKey(this.userdef));
      const yeniLinkedPayload: PersonInsertRequest = {
        ad: formVals.yeniLinkedAd,
        soyad: formVals.yeniLinkedSoyad,
        ceptelefon: formVals.yeniLinkedTelefon,
        userdef: linkedTargetUserdef(this.userdef),
      };

      this.personService.insertPerson(yeniLinkedPayload).subscribe({
        next: (yeniRes) => {
          const yeniResult = unwrapResponse<Person>(yeniRes);
          if (!isSuccessResult(yeniResult)) {
            this.errorMessage =
              yeniResult?.sunucucevap ||
              this.translate.instant('PERSON.CREATE_LINKED_FAILED', { kind });
            this.isSaving = false;
            this.cdr.markForCheck();
            return;
          }
          const yeniLinkedId = extractNewId(yeniResult);

          if (!yeniLinkedId) {
            this.errorMessage = this.translate.instant('PERSON.CREATE_LINKED_NO_ID', { kind });
            this.isSaving = false;
            this.cdr.markForCheck();
            return;
          }

          linked.addPendingLinked(yeniLinkedId);
          linked.stopCreatingNew();
          this.savePersonAndLink();
        },
        error: () => {
          this.errorMessage = this.translate.instant('PERSON.CREATE_LINKED_ERROR');
          this.isSaving = false;
          this.cdr.markForCheck();
        },
      });
      return;
    }

    if (this.isRelationMode) {
      const mevcutLinkedId = formVals.linkedPersonId ? Number(formVals.linkedPersonId) : null;
      if (mevcutLinkedId) linked?.addPendingLinked(mevcutLinkedId);
    }

    this.savePersonAndLink();
  }

  private savePersonAndLink(): void {
    const payload = this.buildPayload(this.form.value);

    const saveObs = this.isEditMode
      ? this.personService.updatePerson({ ...payload, id: this.editPerson!.id })
      : this.personService.insertPerson(payload);

    saveObs.subscribe({
      next: (stdRes) => {
        const stdResult = unwrapResponse<Person>(stdRes);
        // if (!isSuccessResult(stdResult)) {
        //   this.errorMessage =
        //     stdResult?.sunucucevap || this.translate.instant('PERSON.SAVE_FAILED');
        //   this.isSaving = false;
        //   this.cdr.markForCheck();
        //   return;
        // }

        const personId = this.isEditMode ? this.editPerson!.id : extractNewId(stdResult);
        const linked = this.linked();

        if (this.isRelationMode && personId && linked) {
          linked.applyRelationOps(personId).subscribe({
            next: () => this.finishSave(stdRes),
            error: () => {
              this.errorMessage = this.translate.instant('PERSON_FORM.RELATION_UPDATE_FAILED');
              this.isSaving = false;
              this.cdr.markForCheck();
            },
          });
        } else {
          this.finishSave(stdRes);
        }
      },
      error: () => {
        this.errorMessage = this.translate.instant('PERSON_FORM.SAVE_ERROR');
        this.isSaving = false;
        this.cdr.markForCheck();
      },
    });
  }

  private finishSave(stdRes: unknown): void {
    this.isSaving = false;

    if (this.isEditMode) {
      this.notification.notifyUpdated();
    } else {
      this.notification.notifyAdded();
    }

    this.saved.emit(stdRes);
    this.close();
  }

  private buildPayload(v: Record<string, unknown>): PersonInsertRequest {
    const payload: Record<string, unknown> = {
      userdef: this.userdef,
      fotoImage: this.selectedPhoto,
    };
    for (const field of PERSON_FORM_FIELDS) {
      payload[field.key] = this.payloadValueFor(field, v);
    }
    return payload as unknown as PersonInsertRequest;
  }

  private payloadValueFor(field: PersonFormFieldMeta, v: Record<string, unknown>): unknown {
    if (field.isDate) {
      return formatDate(v[field.key] as Date | null);
    }
    if (field.key === 'personelno') {
      return (v['personelno'] as string) || '';
    }
    return (v[field.key] as string) || '';
  }
}
