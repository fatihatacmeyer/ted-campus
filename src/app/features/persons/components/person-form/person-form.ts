import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
import { PersonService } from '../../services/person.service';
import {
  Person,
  UserDef,
  OperationResultResponse,
  PersonInsertRequest,
} from '../../../../core/models/person.model';
import { TypesService, DropdownItem } from '../../services/types.service';
import { formatDate, parseDate } from '../../../../shared/utils/date.utils';
import {
  unwrapResponse,
  isSuccessResult,
  extractNewId,
} from '../../../../shared/utils/response.utils';

/** Form alanlarının tek kaynağı (single source of truth) — alan adları yalnızca burada tanımlanır. */
interface PersonFormFieldMeta {
  key: string;
  required?: boolean;
  isDate?: boolean;
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

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<unknown>();

  /** Düzenleme modunda mı? NguyenChanges tarafından ayarlanır. */
  isEditMode = false;
  isCreatingNewParent = false;

  private fb = inject(FormBuilder);
  private personService = inject(PersonService);
  private typesService = inject(TypesService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  form: FormGroup = this.fb.group(this.buildFormControls());

  private buildFormControls(): Record<string, unknown> {
    const controls: Record<string, unknown> = {};
    for (const field of PERSON_FORM_FIELDS) {
      if (field.required) {
        controls[field.key] = ['', Validators.required];
      } else if (field.isDate) {
        controls[field.key] = [null as Date | null];
      } else {
        // DİKKAT: `null ?? ''` === '' — initValue null ise null kalmalı!
        controls[field.key] = [field.initValue !== undefined ? field.initValue : ''];
      }
    }

    controls['veliSicilId'] = [null];
    controls['yeniVeliAd'] = [''];
    controls['yeniVeliSoyad'] = [''];
    controls['yeniVeliTelefon'] = [''];
    return controls;
  }

  toggleParentMode(): void {
    this.isCreatingNewParent = !this.isCreatingNewParent;

    // Mod değiştiğinde gereksiz alanları temizle
    if (this.isCreatingNewParent) {
      this.form.get('veliSicilId')?.setValue(null);
    } else {
      this.form.patchValue({ yeniVeliAd: '', yeniVeliSoyad: '', yeniVeliTelefon: '' });
    }
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

      //veliSicilId: p.veliSicilId ?? null,
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

  get linkedPersonOptions(): { label: string; value: number }[] {
    // userdef=Ogrenci → show userdef=Veli, userdef=Veli → show userdef=Ogrenci
    const targetUserdef = this.userdef === UserDef.Ogrenci ? UserDef.Veli : UserDef.Ogrenci;
    return this.allPersons
      .filter((p) => p.userdef === targetUserdef)
      .map((p) => ({ label: `${p.adsoyad} (${p.sicilno})`, value: p.id }));
  }

  // submit(): void {
  //   if (this.form.invalid) {
  //     this.form.markAllAsTouched();
  //     return;
  //   }

  //   this.isSaving = true;
  //   this.errorMessage = '';

  //   const payload = this.buildPayload(this.form.value);

  //   if (this.isEditMode) {
  //     // UPDATE: Tek aşamalı — POST /Person (AngelWeb'de de Dynamic GET yok)
  //     this.personService
  //       .updatePerson({ ...payload, id: this.editPerson!.id })
  //       .pipe(takeUntilDestroyed(this.destroyRef))
  //       .subscribe({
  //         next: (response: unknown) => {
  //           this.isSaving = false;

  //           // Backend [] dönerse — muhtemelen parametre sorunu
  //           if (Array.isArray(response) && response.length === 0) {
  //             this.errorMessage = 'Kayıt güncellenemedi. Sunucu boş yanıt döndü.';
  //             return;
  //           }

  //           const result = unwrapResponse<OperationResultResponse>(
  //             response as OperationResultResponse | OperationResultResponse[] | null | undefined,
  //           );

  //           if (isSuccessResult(result)) {
  //             this.saved.emit(response);
  //             this.close();
  //           } else {
  //             const islemno = result?.islemno || 'bilinmiyor';
  //             const islemsonuc = result?.islemsonuc ?? 'bilinmiyor';
  //             this.errorMessage = `Kayıt güncellenemedi. (islemsonuc=${islemsonuc}, islemno=${islemno})`;
  //           }
  //         },
  //         error: (err: unknown) => {
  //           this.isSaving = false;
  //           console.error('Person update error:', err);
  //           this.errorMessage = 'Sunucu hatası: Kayıt güncellenemedi.';
  //         },
  //       });
  //   } else {
  //     // INSERT: Tek aşamalı — POST /Person
  //     this.personService
  //       .insertPerson(payload)
  //       .pipe(takeUntilDestroyed(this.destroyRef))
  //       .subscribe({
  //         next: (response: unknown) => {
  //           this.isSaving = false;

  //           const result = unwrapResponse<OperationResultResponse>(
  //             response as OperationResultResponse | OperationResultResponse[] | null | undefined,
  //           );

  //           if (isSuccessResult(result)) {
  //             this.saved.emit(response);
  //             this.close();
  //           } else {
  //             this.errorMessage =
  //               (result && result.sunucucevap) || 'Kayıt başarısız oldu. Lütfen tekrar deneyin.';
  //           }
  //         },
  //         error: (err: unknown) => {
  //           this.isSaving = false;
  //           console.error('Person insert error:', err);
  //           this.errorMessage = 'Sunucu hatası: Kayıt oluşturulamadı.';
  //         },
  //       });
  //   }
  // }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    const formVals = this.form.value;

    // Eğer YENİ VELİ oluşturuluyorsa
    if (this.userdef === UserDef.Ogrenci && this.isCreatingNewParent) {
      const yeniVeliPayload: PersonInsertRequest = {
        ad: formVals.yeniVeliAd,
        soyad: formVals.yeniVeliSoyad,
        ceptelefon: formVals.yeniVeliTelefon,
        userdef: UserDef.Veli,
      };

      // 1. ÖNCE VELİYİ KAYDET
      this.personService.insertPerson(yeniVeliPayload).subscribe({
        next: (veliRes: any) => {
          const veliResult = unwrapResponse<Person>(veliRes);
          if (!isSuccessResult(veliResult)) {
            this.errorMessage = veliResult?.sunucucevap || 'Veli oluşturulamadı.';
            this.isSaving = false;
            this.cdr.markForCheck();
            return;
          }
          const yeniVeliId = extractNewId(veliResult);

          if (!yeniVeliId) {
            this.errorMessage =
              "Veli oluşturuldu ancak ID'si alınamadığı için öğrenciye bağlanamadı.";
            this.isSaving = false;
            this.cdr.markForCheck();
            return;
          }

          // 2. ARDINDAN ÖĞRENCİYİ KAYDET VE İLİŞKİYİ KUR
          this.saveStudentAndLink(yeniVeliId);
        },
        error: () => {
          this.errorMessage = 'Yeni Veli oluşturulurken hata meydana geldi.';
          this.isSaving = false;
        },
      });
    }
    // Mevcut Veli Seçildiyse veya Öğrenci Değilse normal akış
    else {
      const mevcutVeliId = formVals.veliSicilId ? Number(formVals.veliSicilId) : null;
      this.saveStudentAndLink(mevcutVeliId);
    }
  }

  // Öğrenciyi kaydeder ve relation atamasını yapar
  private saveStudentAndLink(veliId: number | null) {
    const payload = this.buildPayload(this.form.value);

    const saveObs = this.isEditMode
      ? this.personService.updatePerson({ ...payload, id: this.editPerson!.id })
      : this.personService.insertPerson(payload);

    saveObs.subscribe({
      next: (stdRes) => {
        const stdResult = unwrapResponse<Person>(stdRes);
        if (!isSuccessResult(stdResult)) {
          this.errorMessage = stdResult?.sunucucevap || 'Kayıt başarısız oldu.';
          this.isSaving = false;
          this.cdr.markForCheck();
          return;
        }
        const ogrenciId = this.isEditMode ? this.editPerson!.id : extractNewId(stdResult);

        // Düzenlemeyse kendi ID'si, yeniyse backend'den dönen ID
        //const ogrenciId = this.isEditMode ? this.editPerson!.id : Number(stdResult?.islemno);

        // 3. VELİ - ÖĞRENCİ İLİŞKİSİNİ VERİTABANINA YAZ
        if (this.userdef === UserDef.Ogrenci && veliId && ogrenciId) {
          const relationObs = this.isEditMode
            ? this.personService.updateRelationCampus(ogrenciId, veliId)
            : this.personService.addRelationCampus(ogrenciId, veliId);

          relationObs.subscribe({
            next: () => {
              this.isSaving = false;
              this.saved.emit(stdRes);
              this.close();
            },
            error: () => {
              this.errorMessage = 'Kayıt yapıldı ancak veli ilişkisi kurulamadı.';
              this.isSaving = false;
              this.cdr.markForCheck();
            },
          });
        } else {
          // Veli seçilmemişse direkt bitir
          this.isSaving = false;
          this.saved.emit(stdRes);
          this.close();
        }
      },
      error: () => {
        this.errorMessage = 'Kayıt işlemi sırasında bir hata oluştu.';
        this.isSaving = false;
      },
    });
  }

  /** PERSON_FORM_FIELDS metadata'sından insert/update payload'ını üretir. */
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
      // Artık P: T: gibi formatlamalar yapmıyoruz. Direkt girilen Personel No'yu döndürüyoruz!
      return (v['personelno'] as string) || '';
    }
    return (v[field.key] as string) || '';
  }
}
