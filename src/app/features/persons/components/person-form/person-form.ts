import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  OnChanges,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MultiSelectModule } from 'primeng/multiselect';
import { PersonService } from '../../services/person.service';
import {
  Person,
  UserDef,
  OperationResultResponse,
  PersonInsertRequest,
  extractLinkedPersonIds,
  extractLinkedTeacherIds,
  buildLinkedPersonelno,
} from '../../../../core/models/person.model';
import { TypesService, DropdownItem } from '../../services/types.service';
import { formatDate, parseDate } from '../../../../shared/utils/date.utils';
import { unwrapResponse, isSuccessResult } from '../../../../shared/utils/response.utils';

/** Form alanlarının tek kaynağı (single source of truth) — 24 alan adı yalnızca burada tanımlanır. */
interface PersonFormFieldMeta {
  key: string;
  required?: boolean;
  isDate?: boolean;
  isIdArray?: boolean;
  /** Form ilk değeri — yalnızca varsayılandan farklıysa verilir (varsayılan: '') */
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
  { key: 'linkedPersons', isIdArray: true },
  { key: 'linkedTeachers', isIdArray: true },
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
    TooltipModule,
    MultiSelectModule,
  ],
  templateUrl: './person-form.html',
  styleUrl: './person-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonFormComponent implements OnChanges, OnInit {
  @Input() visible = false;
  @Input({ required: true }) userdef!: number;
  @Input() title = 'Yeni Kayıt Ekle';
  @Input() editPerson: Person | null = null;
  @Input() allPersons: Person[] = [];
  @Input() linkedPersonIds: number[] = [];

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<unknown>();

  /** Düzenleme modunda mı? NguyenChanges tarafından ayarlanır. */
  isEditMode = false;

  private fb = inject(FormBuilder);
  private personService = inject(PersonService);
  private typesService = inject(TypesService);
  private destroyRef = inject(DestroyRef);

  form: FormGroup = this.fb.group(this.buildFormControls());

  private buildFormControls(): Record<string, unknown> {
    const controls: Record<string, unknown> = {};
    for (const field of PERSON_FORM_FIELDS) {
      if (field.required) {
        controls[field.key] = ['', Validators.required];
      } else if (field.isDate) {
        controls[field.key] = [null as Date | null];
      } else if (field.isIdArray) {
        controls[field.key] = [[] as number[]];
      } else {
        // DİKKAT: `null ?? ''` === '' — initValue null ise null kalmalı!
        controls[field.key] = [field.initValue !== undefined ? field.initValue : ''];
      }
    }
    return controls;
  }
  isSaving = false;
  errorMessage = '';
  selectedPhoto: string | null = null;
  photoFileName = '';

  readonly genderOptions = [
    { label: 'Erkek', value: 'E' },
    { label: 'Kadın', value: 'K' },
  ];

  readonly bloodTypeOptions = [
    { label: 'A+', value: 'A+' },
    { label: 'A-', value: 'A-' },
    { label: 'B+', value: 'B+' },
    { label: 'B-', value: 'B-' },
    { label: 'AB+', value: 'AB+' },
    { label: 'AB-', value: 'AB-' },
    { label: 'O+', value: 'O+' },
    { label: 'O-', value: 'O-' },
  ];

  // Kurumsal dropdown seçenekleri (TypesService'den yüklenir)
  firmaOptions: DropdownItem[] = [];
  bolumOptions: DropdownItem[] = [];
  pozisyonOptions: DropdownItem[] = [];
  gorevOptions: DropdownItem[] = [];
  altfirmaOptions: DropdownItem[] = [];
  direktorlukOptions: DropdownItem[] = [];
  yakaOptions: DropdownItem[] = [];

  ngOnInit() {
    this.loadDropdownData();
  }

  private loadDropdownData(): void {
    forkJoin({
      cbo_firma: this.typesService.getDropdownList('cbo_firma').pipe(
        catchError((err) => {
          console.error('Firmalar yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_bolum: this.typesService.getDropdownList('cbo_bolum').pipe(
        catchError((err) => {
          console.error('Bölümler yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_pozisyon: this.typesService.getDropdownList('cbo_pozisyon').pipe(
        catchError((err) => {
          console.error('Pozisyonlar yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_gorev: this.typesService.getDropdownList('cbo_gorev').pipe(
        catchError((err) => {
          console.error('Görevler yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_altfirma: this.typesService.getDropdownList('cbo_altfirma').pipe(
        catchError((err) => {
          console.error('Alt firmalar yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_direktorluk: this.typesService.getDropdownList('cbo_direktorluk').pipe(
        catchError((err) => {
          console.error('Direktörlükler yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
      cbo_yaka: this.typesService.getDropdownList('cbo_yaka').pipe(
        catchError((err) => {
          console.error('Yakalar yüklenirken hata:', err);
          return of([] as DropdownItem[]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        ({
          cbo_firma,
          cbo_bolum,
          cbo_pozisyon,
          cbo_gorev,
          cbo_altfirma,
          cbo_direktorluk,
          cbo_yaka,
        }) => {
          this.firmaOptions = cbo_firma;
          this.bolumOptions = cbo_bolum;
          this.pozisyonOptions = cbo_pozisyon;
          this.gorevOptions = cbo_gorev;
          this.altfirmaOptions = cbo_altfirma;
          this.direktorlukOptions = cbo_direktorluk;
          this.yakaOptions = cbo_yaka;
        },
      );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editPerson']) {
      this.isEditMode = this.editPerson !== null;
      if (this.editPerson) {
        this.patchFormForEdit();
      }
    }
  }

  /** Düzenleme modunda form alanlarını mevcut person verisiyle doldurur. */
  private patchFormForEdit(): void {
    // Alan adları PERSON_FORM_FIELDS'tan gelir; değer eşlemesi düzensiz olduğu için açık tutulur.
    const p = this.editPerson!;
    // DEBUG: backend'in bu kişi için gerçekte hangi alanları döndürdüğünü gör.
    // dogumtarih/cinsiyet/kangrubu/telefon1/email/adres/il/ilce/giristarih
    // undefined geliyorsa, backend'in sv2 select prosedürü bu kolonları hiç
    // döndürmüyor demektir — bu durumda düzeltme backend tarafında yapılmalı.
    console.log('[PersonForm] düzenlenen kişi (ham):', p);
    this.form.patchValue({
      ad: p.ad || '',
      soyad: p.soyad || '',
      dogumtarih: parseDate(p.dogumtarih ?? null),
      cinsiyet: p.cinsiyet ?? null,
      kangrubu: p.kangrubu ?? null,
      sicilno: p.sicilno || '',
      personelno: p.personelno || '',
      cardid: p.cardid || '',
      ceptelefon: p.ceptelefon || '',
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
    // linkedPersons'ı personelno alanından oku
    const linkedIds = extractLinkedPersonIds(p.personelno);
    this.form.patchValue({ linkedPersons: linkedIds });
    // linkedTeachers'ı personelno alanından oku
    const teacherIds = extractLinkedTeacherIds(p.personelno);
    this.form.patchValue({ linkedTeachers: teacherIds });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.errorMessage = '';
    this.isSaving = false;
    this.isEditMode = false;
    this.selectedPhoto = null;
    this.photoFileName = '';
    this.form.reset();
    this.form.patchValue({ linkedPersons: [], linkedTeachers: [] });
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

  get linkedPersonOptions(): { label: string; value: number }[] {
    // userdef=Ogrenci → show userdef=Veli, userdef=Veli → show userdef=Ogrenci
    const targetUserdef = this.userdef === UserDef.Ogrenci ? UserDef.Veli : UserDef.Ogrenci;
    return this.allPersons
      .filter((p) => p.userdef === targetUserdef)
      .map((p) => ({ label: `${p.adsoyad} (${p.sicilno})`, value: p.id }));
  }

  get linkedTeacherOptions(): { label: string; value: number }[] {
    return this.allPersons
      .filter((p) => p.userdef === UserDef.Ogretmen)
      .map((p) => ({ label: `${p.adsoyad} (${p.sicilno})`, value: p.id }));
  }

  get showLinkedPersons(): boolean {
    return this.userdef === UserDef.Ogrenci || this.userdef === UserDef.Veli;
  }

  get showLinkedTeachers(): boolean {
    return this.userdef === UserDef.Ogrenci;
  }

  get linkedPersonsLabel(): string {
    return this.userdef === UserDef.Ogrenci ? 'Veliler' : 'Çocuklar';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const payload = this.buildPayload(this.form.value);

    if (this.isEditMode) {
      // UPDATE: Tek aşamalı — POST /Person (AngelWeb'de de Dynamic GET yok)
      this.personService
        .updatePerson({ ...payload, id: this.editPerson!.id })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response: unknown) => {
            this.isSaving = false;

            // Backend [] dönerse — muhtemelen parametre sorunu
            if (Array.isArray(response) && response.length === 0) {
              this.errorMessage = 'Kayıt güncellenemedi. Sunucu boş yanıt döndü.';
              return;
            }

            const result = unwrapResponse<OperationResultResponse>(
              response as OperationResultResponse | OperationResultResponse[] | null | undefined,
            );

            if (isSuccessResult(result)) {
              this.saved.emit(response);
              this.close();
            } else {
              const islemno = result?.islemno || 'bilinmiyor';
              const islemsonuc = result?.islemsonuc ?? 'bilinmiyor';
              this.errorMessage = `Kayıt güncellenemedi. (islemsonuc=${islemsonuc}, islemno=${islemno})`;
            }
          },
          error: (err: unknown) => {
            this.isSaving = false;
            console.error('Person update error:', err);
            this.errorMessage = 'Sunucu hatası: Kayıt güncellenemedi.';
          },
        });
    } else {
      // INSERT: Tek aşamalı — POST /Person
      this.personService
        .insertPerson(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response: unknown) => {
            this.isSaving = false;

            const result = unwrapResponse<OperationResultResponse>(
              response as OperationResultResponse | OperationResultResponse[] | null | undefined,
            );

            if (isSuccessResult(result)) {
              this.saved.emit(response);
              this.close();
            } else {
              this.errorMessage =
                (result && result.sunucucevap) || 'Kayıt başarısız oldu. Lütfen tekrar deneyin.';
            }
          },
          error: (err: unknown) => {
            this.isSaving = false;
            console.error('Person insert error:', err);
            this.errorMessage = 'Sunucu hatası: Kayıt oluşturulamadı.';
          },
        });
    }
  }

  /** PERSON_FORM_FIELDS metadata'sından insert/update payload'ını üretir. */
  private buildPayload(v: Record<string, unknown>): PersonInsertRequest {
    const payload: Record<string, unknown> = {
      userdef: this.userdef,
      fotoImage: this.selectedPhoto,
    };
    for (const field of PERSON_FORM_FIELDS) {
      if (field.isIdArray) continue; // linked* alanları personelno'ya gömülür
      payload[field.key] = this.payloadValueFor(field, v);
    }
    return payload as unknown as PersonInsertRequest;
  }

  private payloadValueFor(field: PersonFormFieldMeta, v: Record<string, unknown>): unknown {
    if (field.isDate) {
      return formatDate(v[field.key] as Date | null);
    }
    if (field.key === 'personelno') {
      return this.showLinkedPersons
        ? buildLinkedPersonelno(
            (v['linkedPersons'] as number[]) || [],
            (v['linkedTeachers'] as number[]) || [],
          )
        : (v['personelno'] as string) || '';
    }
    return (v[field.key] as string) || '';
  }
}
