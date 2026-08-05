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
import { concat, forkJoin, Observable, of } from 'rxjs';
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
  RelationCampusRow,
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

/**
 * Mevcut ilişki satırı. Yön, formun userdef'ine bağlıdır:
 *  - Öğrenci modunda (userdef=11) linkedId = veli sicil id  (sp_relationcampus_s tip=2)
 *  - Veli modunda (userdef=12) linkedId = öğrenci sicil id (sp_relationcampus_s tip=1)
 */
interface ExistingRelation {
  relid: number; // RelationCampus.Id — güncelleme/silme için zorunlu
  linkedId: number;
  linkedName: string;
  sicilno: string;
}

/** "Değiştir" işlemi — mevcut ilişki satırı (relid) yeni kişiye güncellenir (sp_velicampus_u). */
interface RelationChange {
  relid: number;
  newLinkedId: number;
}

/** Şablonda listelenen birleşik satır: mevcut ilişki veya bekleyen ekleme. */
interface RelationDisplayRow extends ExistingRelation {
  changed?: boolean;
  pending?: boolean;
}

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
  isCreatingNewLinked = false;

  // ─── İlişkili kişi yönetimi (userdef=11 Öğrenci veya 12 Veli) ───
  existingRelations: ExistingRelation[] = []; // DB'deki mevcut ilişkiler
  removedRelIds: number[] = []; // silinecek ilişkiler (sp_velicampus_d)
  changedRelations: RelationChange[] = []; // velisi değişecek ilişkiler (sp_velicampus_u)
  pendingAdditions: number[] = []; // eklenecek veli sicil id'leri (sp_velicampus_i)
  changingRelid: number | null = null; // "Değiştir" modundaki satırın relid'si
  confirmRemoveKey: string | null = null; // "Kaldır" onayı bekleyen satır

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

    controls['linkedPersonId'] = [null];
    controls['yeniLinkedAd'] = [''];
    controls['yeniLinkedSoyad'] = [''];
    controls['yeniLinkedTelefon'] = [''];
    controls['changeLinkedId'] = [null];
    return controls;
  }

  toggleNewLinkedMode(): void {
    this.isCreatingNewLinked = !this.isCreatingNewLinked;

    // Mod değiştiğinde gereksiz alanları temizle
    if (this.isCreatingNewLinked) {
      this.form.get('linkedPersonId')?.setValue(null);
    } else {
      this.form.patchValue({ yeniLinkedAd: '', yeniLinkedSoyad: '', yeniLinkedTelefon: '' });
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
      this.resetRelationState();
      if (this.editPerson) {
        this.patchFormForEdit();
        // Düzenleme modunda mevcut ilişkileri ilişki tablosundan yükle (öğrenci: tip=2, veli: tip=1)
        if (this.isRelationMode) {
          this.loadExistingRelations();
        }
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
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.errorMessage = '';
    this.isSaving = false;
    this.isEditMode = false;
    this.selectedPhoto = null;
    this.photoFileName = '';
    this.resetRelationState();
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

  /** İlişki yönetimi bu formda aktif mi (Öğrenci veya Veli). */
  get isRelationMode(): boolean {
    return this.userdef === UserDef.Ogrenci || this.userdef === UserDef.Veli;
  }

  /** İlişkili kişinin tekil adı: öğrenci düzenlerken "Veli", veli düzenlerken "Öğrenci". */
  get linkedKind(): string {
    return this.userdef === UserDef.Veli ? 'Öğrenci' : 'Veli';
  }

  /** Bölüm başlığı: "Veli Bilgisi" / "Çocuk Bilgisi". */
  get linkedSectionTitle(): string {
    return this.userdef === UserDef.Veli ? 'Çocuk Bilgisi' : 'Veli Bilgisi';
  }

  /** Toggle buton etiketi: "Listeden Seç" / "Yeni Veli Oluştur" / "Yeni Öğrenci Oluştur". */
  get newLinkedToggleLabel(): string {
    return this.isCreatingNewLinked ? 'Listeden Seç' : `Yeni ${this.linkedKind} Oluştur`;
  }

  /** "Veli seçin" / "Öğrenci seçin" placeholder'ı. */
  get linkedSelectPlaceholder(): string {
    return `${this.linkedKind} seçin`;
  }

  /** Değiştir dropdown'ı placeholder'ı: "Yeni veli seçin" / "Yeni öğrenci seçin". */
  get changeLinkedPlaceholder(): string {
    return `Yeni ${this.linkedKind.toLowerCase()} seçin`;
  }

  /** "Veli Ekle" / "Öğrenci Ekle" buton etiketi. */
  get addLinkedButtonLabel(): string {
    return `${this.linkedKind} Ekle`;
  }

  /** Değiştir tooltip'i: "Veliyi Değiştir" / "Öğrenciyi Değiştir". */
  get changeLinkedTooltip(): string {
    return this.userdef === UserDef.Veli ? 'Öğrenciyi Değiştir' : 'Veliyi Değiştir';
  }

  /** Kaldır tooltip'i: "Veli İlişkisini Kaldır" / "Öğrenci İlişkisini Kaldır". */
  get removeLinkedTooltip(): string {
    return this.userdef === UserDef.Veli ? 'Öğrenci İlişkisini Kaldır' : 'Veli İlişkisini Kaldır';
  }

  /** Boş liste metni: "Veli atanmamış" / "Çocuk atanmamış". */
  get noLinkedText(): string {
    return this.userdef === UserDef.Veli ? 'Çocuk atanmamış' : 'Veli atanmamış';
  }

  get linkedPersonOptions(): { label: string; value: number }[] {
    // userdef=Ogrenci → show userdef=Veli, userdef=Veli → show userdef=Ogrenci
    const targetUserdef = this.userdef === UserDef.Ogrenci ? UserDef.Veli : UserDef.Ogrenci;

    // Zaten ilişkili olan velileri dropdown'dan çıkar (mükerrer ilişki oluşmasın):
    // - mevcut ilişkiler (kaldırılmamış olanlar)
    // - bekleyen eklemeler
    const excludedIds = new Set<number>();
    for (const rel of this.existingRelations) {
      if (!this.removedRelIds.includes(rel.relid)) excludedIds.add(rel.linkedId);
    }
    for (const linkedId of this.pendingAdditions) excludedIds.add(linkedId);

    return (
      this.allPersons
        .filter((p) => p.userdef === targetUserdef && !excludedIds.has(p.id))
        // .map((p) => ({ label: `${p.adsoyad} (${p.sicilno})`, value: p.id }));
        .map((p) => ({ label: `${p.adsoyad} (${p.sicilno ? p.sicilno : p.id})`, value: p.id }))
    );
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

    // Eğer YENİ ilişkili kişi oluşturuluyorsa (öğrenci düzenlerken veli, veli düzenlerken öğrenci)
    if (this.isCreatingNewLinked) {
      const targetUserdef = this.userdef === UserDef.Ogrenci ? UserDef.Veli : UserDef.Ogrenci;
      const yeniLinkedPayload: PersonInsertRequest = {
        ad: formVals.yeniLinkedAd,
        soyad: formVals.yeniLinkedSoyad,
        ceptelefon: formVals.yeniLinkedTelefon,
        userdef: targetUserdef,
      };

      // 1. ÖNCE YENİ KİŞİYİ KAYDET
      this.personService.insertPerson(yeniLinkedPayload).subscribe({
        next: (yeniRes) => {
          const yeniResult = unwrapResponse<Person>(yeniRes);
          if (!isSuccessResult(yeniResult)) {
            this.errorMessage = yeniResult?.sunucucevap || `${this.linkedKind} oluşturulamadı.`;
            this.isSaving = false;
            this.cdr.markForCheck();
            return;
          }
          const yeniLinkedId = extractNewId(yeniResult);

          if (!yeniLinkedId) {
            this.errorMessage = `${this.linkedKind} oluşturuldu ancak ID'si alınamadığı için bağlanamadı.`;
            this.isSaving = false;
            this.cdr.markForCheck();
            return;
          }

          // 2. ARDINDAN DÜZENLENEN KİŞİYİ KAYDET VE İLİŞKİYİ KUR
          this.addPendingLinked(yeniLinkedId);
          this.isCreatingNewLinked = false;
          this.savePersonAndLink();
        },
        error: () => {
          this.errorMessage = 'Yeni Veli oluşturulurken hata meydana geldi.';
          this.isSaving = false;
          this.cdr.markForCheck();
        },
      });
      return;
    }

    // Mevcut ilişkili kişi seçildiyse (ekleme alanı) bekleyen eklemelere al.
    if (this.isRelationMode) {
      const mevcutLinkedId = formVals.linkedPersonId ? Number(formVals.linkedPersonId) : null;
      if (mevcutLinkedId) this.addPendingLinked(mevcutLinkedId);
    }

    this.savePersonAndLink();
  }

  /**
   * Öğrenciyi kaydeder, ardından bekleyen ilişki işlemlerini (sil → değiştir → ekle)
   * sırayla uygular. İlişki işlemleri öğrenci kaydına bağlı olduğu için öğrenci
   * (insert/update) başarılı olduktan sonra çalıştırılır.
   */
  private savePersonAndLink(): void {
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

        const personId = this.isEditMode ? this.editPerson!.id : extractNewId(stdResult);

        if (this.isRelationMode && personId) {
          this.applyRelationOps(personId).subscribe({
            next: () => this.finishSave(stdRes),
            error: () => {
              this.errorMessage = 'Kayıt yapıldı ancak ilişki güncellenemedi.';
              this.isSaving = false;
              this.cdr.markForCheck();
            },
          });
        } else {
          this.finishSave(stdRes);
        }
      },
      error: () => {
        this.errorMessage = 'Kayıt işlemi sırasında bir hata oluştu.';
        this.isSaving = false;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Bekleyen ilişki değişikliklerini sırayla uygular:
   *   1. silmeler  → sp_velicampus_d (relid)
   *   2. değişimler → sp_velicampus_u (relid ile — relid eksikse SP sessizce hiçbir satırı güncellemez)
   *   3. eklemeler → sp_velicampus_i (veli sicil id)
   */
  private applyRelationOps(personId: number): Observable<unknown> {
    const ops: Observable<unknown>[] = [];
    const ogrenciModu = this.userdef === UserDef.Ogrenci;

    for (const relid of this.removedRelIds) {
      ops.push(this.personService.deleteRelationCampus(relid));
    }
    for (const change of this.changedRelations) {
      // sp_velicampus_u(ogrenciSicilId, veliSicilId, relid): sabit taraf yöne göre değişir.
      ops.push(
        ogrenciModu
          ? this.personService.updateRelationCampus(personId, change.newLinkedId, change.relid)
          : this.personService.updateRelationCampus(change.newLinkedId, personId, change.relid),
      );
    }
    for (const linkedId of this.pendingAdditions) {
      ops.push(
        ogrenciModu
          ? this.personService.addRelationCampus(personId, linkedId)
          : this.personService.addRelationCampus(linkedId, personId),
      );
    }

    return ops.length ? concat(...ops) : of(null);
  }

  private finishSave(stdRes: unknown): void {
    this.isSaving = false;
    this.saved.emit(stdRes);
    this.close();
  }

  // ─── Veli ilişkisi yönetimi (sp_relationcampus_s / sp_velicampus_i-u-d) ───

  /**
   * Düzenleme modunda mevcut ilişkileri yükler:
   *  - öğrenci düzenlerken sp_relationcampus_s tip=2 (velileri) → { VeliSicilId, relid }
   *  - veli düzenlerken sp_relationcampus_s tip=1 (çocukları) → { OgrenciSicilId, relid }
   */
  private loadExistingRelations(): void {
    const personId = this.editPerson!.id;
    const ogrenciModu = this.userdef === UserDef.Ogrenci;
    const obs = ogrenciModu
      ? this.personService.getStudentRelation(personId)
      : this.personService.getParentRelations(personId);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows: RelationCampusRow[]) => {
        console.log('[Rel] mevcut ilişkiler (ham):', JSON.stringify(rows));
        this.existingRelations = (rows || []).map((r) => {
          const linkedId = Number(ogrenciModu ? r.VeliSicilId : r.OgrenciSicilId);
          const relid = Number(r.relid ?? r.Id);
          console.log(
            '[Rel] satır anahtarları:',
            Object.keys(r),
            '| VeliSicilId:',
            r.VeliSicilId,
            '| OgrenciSicilId:',
            r.OgrenciSicilId,
            '| relid:',
            r.relid,
            '| → linkedId:',
            linkedId,
            '| relid:',
            relid,
          );
          const linked = this.allPersons.find((p) => p.id === linkedId);
          return {
            relid,
            linkedId,
            linkedName: linked ? linked.adsoyad : `${this.linkedKind} #${linkedId}`,
            sicilno: linked?.sicilno ?? '',
          };
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[PersonForm] Mevcut ilişkiler yüklenemedi:', err);
        this.existingRelations = [];
        this.cdr.markForCheck();
      },
    });
  }

  private resetRelationState(): void {
    this.existingRelations = [];
    this.removedRelIds = [];
    this.changedRelations = [];
    this.pendingAdditions = [];
    this.changingRelid = null;
    this.confirmRemoveKey = null;
    this.isCreatingNewLinked = false;
  }

  /** Şablonda listelenen birleşik satırlar: mevcut (değişenler güncel isimle) + bekleyen eklemeler. */
  get relationRows(): RelationDisplayRow[] {
    const rows: RelationDisplayRow[] = [];

    for (const rel of this.existingRelations) {
      if (this.removedRelIds.includes(rel.relid)) continue;

      const change = this.changedRelations.find((c) => c.relid === rel.relid);
      const linkedId = change ? change.newLinkedId : rel.linkedId;
      const linked = this.allPersons.find((p) => p.id === linkedId);

      rows.push({
        relid: rel.relid,
        linkedId,
        linkedName: linked ? linked.adsoyad : `${this.linkedKind} #${linkedId}`,
        sicilno: linked?.sicilno ?? '',
        changed: !!change,
      });
    }

    for (const linkedId of this.pendingAdditions) {
      const linked = this.allPersons.find((p) => p.id === linkedId);
      rows.push({
        relid: 0,
        linkedId,
        linkedName: linked ? linked.adsoyad : `${this.linkedKind} #${linkedId}`,
        sicilno: linked?.sicilno ?? '',
        pending: true,
      });
    }

    return rows;
  }

  /** @for track anahtarı — relid yoksa (bekleyen ekleme) ilişkili kişi id üzerinden tekil olur. */
  rowKey(row: RelationDisplayRow): string {
    return row.relid ? `rel-${row.relid}` : `add-${row.linkedId}`;
  }

  /** Eklenmek üzere seçilen mevcut kişiyi bekleyen eklemelere alır (edit modundaki "Ekle" butonu). */
  addSelectedLinked(): void {
    const linkedId = this.form.value.linkedPersonId ? Number(this.form.value.linkedPersonId) : null;
    if (!linkedId) return;
    this.addPendingLinked(linkedId);
    this.form.patchValue({ linkedPersonId: null });
    this.cdr.markForCheck();
  }

  private addPendingLinked(linkedId: number): void {
    if (this.pendingAdditions.includes(linkedId)) return;
    this.pendingAdditions.push(linkedId);
  }

  /** Satırı "Değiştir" moduna alır — dropdown ile yeni ilişkili kişi seçilir. */
  startChange(row: RelationDisplayRow): void {
    if (!row.relid) return;
    this.changingRelid = row.relid;
    this.form.patchValue({ changeLinkedId: null });
    this.cdr.markForCheck();
  }

  cancelChange(): void {
    this.changingRelid = null;
    this.form.patchValue({ changeLinkedId: null });
    this.cdr.markForCheck();
  }

  /** "Değiştir" modunda seçilen yeni kişiyi onaylar → kayıtta sp_velicampus_u (relid ile) uygulanır. */
  confirmChange(): void {
    const linkedId = this.form.value.changeLinkedId ? Number(this.form.value.changeLinkedId) : null;
    if (!linkedId || !this.changingRelid) return;

    const relid = this.changingRelid;
    const idx = this.changedRelations.findIndex((c) => c.relid === relid);
    if (idx >= 0) {
      this.changedRelations[idx] = { relid, newLinkedId: linkedId };
    } else {
      this.changedRelations.push({ relid, newLinkedId: linkedId });
    }
    // Değiştirilen satır aynı zamanda silinmemeli
    this.removedRelIds = this.removedRelIds.filter((id) => id !== relid);

    this.changingRelid = null;
    this.form.patchValue({ changeLinkedId: null });
    this.cdr.markForCheck();
  }

  /** Satırda iki aşamalı silme onayı başlatır (yanlışlıkla tıklamaya karşı). */
  requestRemove(row: RelationDisplayRow): void {
    this.confirmRemoveKey = this.rowKey(row);
    this.cdr.markForCheck();
  }

  cancelRemove(): void {
    this.confirmRemoveKey = null;
    this.cdr.markForCheck();
  }

  /** Silme onayını tamamlar → sp_velicampus_d (relid) işaretlenir. */
  confirmRemove(row: RelationDisplayRow): void {
    this.confirmRemoveKey = null;
    this.removeRelation(row);
  }

  /** İlişkiyi silinmek üzere işaretler veya bekleyen eklemeyi geri alır. */
  removeRelation(row: RelationDisplayRow): void {
    if (row.relid) {
      this.removedRelIds.push(row.relid);
      this.changedRelations = this.changedRelations.filter((c) => c.relid !== row.relid);
    } else {
      this.pendingAdditions = this.pendingAdditions.filter((id) => id !== row.linkedId);
    }
    if (this.changingRelid === row.relid) this.changingRelid = null;
    this.cdr.markForCheck();
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
