import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { PersonService } from '../../services/person.service';
import { LOGIN_SEND_MAX, summarizeNames } from '../../utils/login-send.utils';
import { Person, UserDef, getUserDefLabelKey } from '../../../../core/models/person.model';
import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
} from '../../../../shared/components/customizable-table/customizable-table';
import {
  PERSON_COLUMNS,
  PERSON_DEFAULT_FIELDS,
} from '../../../../shared/config/person-table.config';
import { PersonFormComponent } from '../../components/person-form/person-form';
import { PersonExitDialogComponent } from '../../components/person-exit-dialog/person-exit-dialog';
import { PersonLeaveDialogComponent } from '../../components/person-leave-dialog/person-leave-dialog';
import { PersonProfileComponent } from '../../components/person-profile/person-profile';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { NotificationService } from '../../../../core/services/notification.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PersonBusAssignDialogComponent } from '../../components/person-bus-assign-dialog/person-bus-assign-dialog';
import { BulkImportComponent } from '../../components/bulk-import/bulk-import';
import { ImportKind } from '../../models/bulk-import.model';
import { DialogModule } from 'primeng/dialog';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-person-crud',
  standalone: true,
  imports: [
    PageHeaderComponent,
    CustomizableTableComponent,
    ColumnCellDirective,
    PersonFormComponent,
    PersonExitDialogComponent,
    PersonLeaveDialogComponent,
    PersonProfileComponent,
    ButtonModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslatePipe,
    PersonBusAssignDialogComponent,
    BulkImportComponent,
    DialogModule,
  ],
  templateUrl: './person-crud.html',
  styleUrl: './person-crud.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonCrudComponent implements OnInit {
  /** Route'dan gelen userdef değeri. */
  readonly USERDEF: UserDef;
  readonly UserDef = UserDef;

  persons: Person[] = [];
  allPersons: Person[] = [];
  isLoading = false;
  errorMessage = '';
  showAddDialog = false;
  editPerson: Person | null = null;
  showExitDialog = false;
  exitPerson: Person | null = null;
  exitMode: 'exit' | 'restore' = 'exit';
  showLeaveDialog = false;
  leavePerson: Person | null = null;
  showProfileModal = false;
  selectedProfilePerson: Person | null = null;

  showBusAssignDialog = false;
  busAssignPerson: Person | null = null;

  /** Toplu aktarım diyaloğu (yalnızca öğrenci sayfası). Aktarım sürerken kapatılamaz. */
  showBulkImport = false;
  bulkImporting = false;

  /**
   * Toplu bilgi gönderimi: tablo varsayılan olarak seçimsizdir; "Bilgileri Toplu Gönder"
   * ile çoklu seçim açılır. Seçim satır referansıyla tutulduğu için liste yenilenince sıfırlanır.
   */
  bulkSendMode = false;
  bulkSendSelected: Person[] = [];
  showBulkSendConfirm = false;
  bulkSending = false;

  /** Veli sayfası: veliId → çocukları (sp_relationcampus_s tip=0'dan tek çağrıda kurulur). */
  childrenMap = new Map<number, Person[]>();

  /** Öğrenci sayfası: ogrenciId → velileri (aynı getAllRelations çağrısında kurulur). */
  parentsMap = new Map<number, Person[]>();

  /** Tablo sütunları — userdef'a göre başlık override + export hook'ları uygulanır. */
  columns: ColumnDef<Person>[] = PERSON_COLUMNS.map((c) => ({ ...c }));

  readonly PERSON_DEFAULT_FIELDS = PERSON_DEFAULT_FIELDS;

  private personService = inject(PersonService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.USERDEF = Number(this.route.snapshot.data['userDef']) as UserDef;
  }

  // Derived labels

  get pageTitleKey(): string {
    return getUserDefLabelKey(this.USERDEF) + '_PLURAL';
  }

  get addLabelKey(): string {
    return 'PERSON.ADD_' + getUserDefLabelKey(this.USERDEF).split('.')[1];
  }

  get currentFormUserDef(): number {
    return this.editPerson?.userdef || this.USERDEF;
  }

  get formTitleKey(): string {
    const targetUserDef = this.currentFormUserDef;
    return this.editPerson
      ? 'PERSON.EDIT_' + getUserDefLabelKey(targetUserDef).split('.')[1]
      : 'PERSON.ADD_' + getUserDefLabelKey(targetUserDef).split('.')[1];
  }

  readonly descriptionTextKey = 'PERSON.LIST_DESCRIPTION';

  readonly hasProfileModal = true;

  /** İşlem kolu sadece Ogrenci sayfasında gösterilir (İzin Ata). */
  get showActionsColumn(): boolean {
    return this.USERDEF === UserDef.Ogrenci;
  }

  /** Excel ile toplu aktarım Öğrenci ve Veli sayfalarında vardır. */
  get canBulkImport(): boolean {
    return this.USERDEF === UserDef.Ogrenci || this.USERDEF === UserDef.Veli;
  }

  get bulkImportKind(): ImportKind {
    return this.USERDEF === UserDef.Veli ? 'parent' : 'student';
  }

  get bulkImportTitleKey(): string {
    return this.USERDEF === UserDef.Veli ? 'BULK_IMPORT.TITLE_PARENT' : 'BULK_IMPORT.TITLE';
  }

  onBulkImportingChange(importing: boolean): void {
    this.bulkImporting = importing;
    this.cdr.markForCheck();
  }

  /** Aktarım sonrası listeyi (ve ilişki haritalarını) yeniler. */
  onBulkImported(): void {
    this.fetchPersonList();
  }

  /** Ogrenci ve Veli sayfalarında allPersons gereklidir. */
  get needsAllPersons(): boolean {
    return this.USERDEF !== UserDef.Ogretmen;
  }

  get columnOverrides(): { field: string; header: string }[] {
    if (this.USERDEF === UserDef.Ogrenci) {
      return [
        { field: 'veliAdSoyad', header: 'PERSON_COLUMNS.PARENTS' },
        { field: 'firmaad', header: 'PERSON_COLUMNS.CAMPUS' },
        { field: 'bolumad', header: 'PERSON_COLUMNS.CLASS' },
        { field: 'direktorlukad', header: 'PERSON_COLUMNS.EDUCATION_LEVEL' },
      ];
    }
    if (this.USERDEF === UserDef.Veli) {
      return [
        { field: 'veliAdSoyad', header: 'PERSON_COLUMNS.CHILDREN' },
        { field: 'ogrencilerSinif', header: 'PERSON_COLUMNS.STUDENTS_CLASS' },
        { field: 'ogrenciKampusleri', header: 'PERSON_COLUMNS.CAMPUS' },
        { field: 'personelno', header: 'PERSON_COLUMNS.TC' }, // Sütun adını TC Kimlik yaptık
        { field: 'sicilno', header: 'PERSON_COLUMNS.SICIL_NO' },
      ];
    }
    if (this.USERDEF === UserDef.Ogretmen) {
      return [
        { field: 'firmaad', header: 'PERSON_COLUMNS.CAMPUS' },
        { field: 'bolumad', header: 'PERSON_COLUMNS.DEPARTMENT_GROUP' },
        { field: 'pozisyonad', header: 'PERSON_COLUMNS.BRANCH' },
        { field: 'personelno', header: 'PERSON_COLUMNS.PERSONEL_NO' },
      ];
    }
    return [];
  }

  get currentDefaultFields(): string[] {
    if (this.USERDEF === UserDef.Ogrenci) {
      return [
        'ad',
        'soyad',
        'cardid',
        'firmaad',
        'bolumad',
        'ceptelefon',
        'direktorlukad',
        'veliAdSoyad',
        'gelisServisPlaka',
        'donusServisPlaka',
      ];
    }

    if (this.USERDEF === UserDef.Veli) {
      return [
        'ad',
        'soyad',
        'personelno',
        'ceptelefon',
        'ogrencilerSinif',
        'ogrenciKampusleri',
        'cardid',
      ];
    }

    if (this.USERDEF === UserDef.Ogretmen) {
      return ['ad', 'soyad', 'personelno', 'firmaad', 'bolumad', 'pozisyonad', 'ceptelefon'];
    }

    return this.PERSON_DEFAULT_FIELDS;
  }

  // Column config

  private applyColumnOverrides(): void {
    for (const override of this.columnOverrides) {
      const col = this.columns.find((c) => c.field === override.field);
      if (col) col.header = override.header;
    }
  }

  /** Sınıf sütunlarında seviye/şube çoklu seçim filtresi (Veli: çocukların sınıfları, Öğrenci: kendi sınıfı). */
  private applyClassFilters(): void {
    const field =
      this.USERDEF === UserDef.Veli
        ? 'ogrencilerSinif'
        : this.USERDEF === UserDef.Ogrenci
          ? 'bolumad'
          : null;
    const col = field ? this.columns.find((c) => c.field === field) : null;
    if (col) col.filterType = 'class';
  }

  /** Dışa aktarmada görünen hücre değerini değil, kişiye özel değeri kullan. */
  private applyExportHooks(): void {
    const setHook = (field: string, fn: (p: Person) => string): void => {
      const col = this.columns.find((c) => c.field === field);
      if (col) col.exportValue = fn;
    };

    if (this.needsAllPersons) {
      // personelno hook'u yok: excel'de direkt kendi değerini (gerçek personel no) yazar
    }
    setHook('indirimorani', (p) => (p.indirimorani != null ? `${p.indirimorani}%` : ''));

    // Öğrenci ("Veliler") ve Veli ("Çocuklar") sayfalarında ilgili kolon excel'e ad listesi olarak yazılsın
    if (this.USERDEF !== UserDef.Ogretmen) {
      setHook('veliAdSoyad', (p) => this.childrenSummary(p));
    }
  }

  // Lifecycle

  ngOnInit() {
    this.applyColumnOverrides();
    this.applyClassFilters();
    this.applyExportHooks();
    this.fetchPersonList();
  }

  // Data

  fetchPersonList(): void {
    this.isLoading = true;
    this.errorMessage = '';
    if (this.bulkSendMode) this.exitBulkSend();

    this.personService
      .getPersonListCampus()
      //.getPersonList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Person[]) => {
          if (this.needsAllPersons) {
            this.allPersons = data;
          }
          this.persons = data.filter((p) => p.userdef === this.USERDEF);

          // Öğrenci ("Veliler") ve Veli ("Çocuklar") sayfaları için ilişki haritalarını kur
          if (this.needsAllPersons) {
            this.loadRelationsMap();
          } else {
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.errorMessage = this.translate.instant('PERSON_CRUD.ERR_LOAD_LIST');
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadRelationsMap(): void {
    this.personService
      .getAllRelations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (relations) => {
          const personLookup = new Map<number, Person>();
          for (const p of this.allPersons) {
            personLookup.set(p.id, p);
          }

          this.childrenMap.clear();
          this.parentsMap.clear();

          for (const rel of relations || []) {
            const veliId = Number(rel.VeliSicilId);
            const ogrenciId = Number(rel.OgrenciSicilId);

            const veli = personLookup.get(veliId);
            const child = personLookup.get(ogrenciId);

            if (!veli && !child) continue;

            // childrenMap: eski davranış korunur (çocuk çözülebilen her satır)
            if (child) {
              if (!this.childrenMap.has(veliId)) this.childrenMap.set(veliId, []);
              this.childrenMap.get(veliId)!.push(child);
            }
            // parentsMap: ters yön — veli çözülebilen her satır
            if (veli) {
              if (!this.parentsMap.has(ogrenciId)) this.parentsMap.set(ogrenciId, []);
              this.parentsMap.get(ogrenciId)!.push(veli);
            }
          }

          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PersonCrud] Veli-öğrenci ilişkileri yüklenemedi:', err);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onForgotPasswordRequest(person: Person): void {
    if (!this.canSendLoginInfo) {
      this.notification.error('PERSON_CRUD.ONLY_STUDENT_PARENT');
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    this.personService
      .sendLoginInfo([person.id])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isLoading = false;
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'PERSON_CRUD.LOGIN_DELETED');
          } else {
            this.notification.error(result.sunucuCevap || 'PERSON_CRUD.LOGIN_NOT_FOUND');
          }

          this.showProfileModal = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.notification.error('COMMON.SERVER_ERROR');
          this.cdr.markForCheck();
        },
      });
  }

  // Toplu bilgi gönderimi

  /** Bilgi gönderimi (tekli ve toplu) yalnızca Öğrenci ve Veli sayfalarında vardır. */
  get canSendLoginInfo(): boolean {
    return this.USERDEF === UserDef.Ogrenci || this.USERDEF === UserDef.Veli;
  }

  get bulkSendOverLimit(): boolean {
    return this.bulkSendSelected.length > LOGIN_SEND_MAX;
  }

  /** Onay penceresindeki ad listesi (ilk 5 ad + kalan sayısı). */
  get bulkSendNames(): { shown: string; rest: number } {
    return summarizeNames(this.bulkSendSelected.map((p) => p.adsoyad));
  }

  /** "Bilgileri Toplu Gönder": tabloda çoklu seçimi açar. */
  startBulkSend(): void {
    this.bulkSendMode = true;
    this.bulkSendSelected = [];
  }

  /** Seçim modundan çıkar ve seçimi temizler (iptal, başarılı gönderim, liste yenileme). */
  exitBulkSend(): void {
    this.bulkSendMode = false;
    this.bulkSendSelected = [];
    this.showBulkSendConfirm = false;
    this.cdr.markForCheck();
  }

  onBulkSelectionChange(rows: Person[]): void {
    this.bulkSendSelected = rows;
  }

  openBulkSendConfirm(): void {
    if (!this.bulkSendSelected.length) return;
    if (this.bulkSendOverLimit) {
      this.notification.warning(
        this.translate.instant('PERSON_CRUD.BULK_SEND_LIMIT', { max: LOGIN_SEND_MAX }),
      );
      return;
    }
    this.showBulkSendConfirm = true;
  }

  closeBulkSendConfirm(): void {
    if (this.bulkSending) return;
    this.showBulkSendConfirm = false;
  }

  sendBulkLoginInfo(): void {
    if (this.bulkSending || !this.bulkSendSelected.length || this.bulkSendOverLimit) return;

    this.bulkSending = true;
    this.personService
      .sendLoginInfo(this.bulkSendSelected.map((p) => p.id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.bulkSending = false;
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'PERSON_CRUD.BULK_SEND_SUCCESS');
            this.exitBulkSend();
          } else {
            // Hata: seçim korunur, kullanıcı tekrar deneyebilir
            this.notification.error(result.sunucuCevap || 'PERSON_CRUD.LOGIN_NOT_FOUND');
            this.showBulkSendConfirm = false;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.bulkSending = false;
          this.notification.error('COMMON.SERVER_ERROR');
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * veliAdSoyad kolon hücresi:
   *   - Öğrenci sayfası → veli adları (ilk 2 + kalan sayısı) — parentsMap'ten
   *   - Veli sayfası → çocuk adları (ilk 2 + kalan sayısı) — childrenMap'ten
   *   - Öğretmen sayfası → tek veli adı (sicilcampus TOP(1), eski davranış)
   * İlişki haritası boşsa sicil listesinden gelen tek veli adına düşülür.
   */
  childrenSummary(p: Person): string {
    if (this.USERDEF === UserDef.Ogretmen) {
      return p.veliAdSoyad || '-';
    }
    const linked =
      (this.USERDEF === UserDef.Veli ? this.childrenMap : this.parentsMap).get(p.id) ?? [];
    if (!linked.length) return p.veliAdSoyad || '-';
    const names = linked.map((k) => k.adsoyad);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} daha`;
  }

  /**
   * Satırda tüm ilişkili kişi adlarını tooltip olarak döndürür (boşsa null → tooltip yok).
   * Öğrenci → veliler, Veli → çocuklar, Öğretmen → tooltip yok.
   */
  childrenTooltip(p: Person): string | null {
    if (this.USERDEF === UserDef.Ogretmen) return null;
    const linked =
      (this.USERDEF === UserDef.Veli ? this.childrenMap : this.parentsMap).get(p.id) ?? [];
    return linked.length ? linked.map((k) => k.adsoyad).join('\n') : null;
  }

  // Dialog open / close

  openAddDialog(): void {
    this.editPerson = null;
    this.showAddDialog = true;
  }

  onRowClick(person: Person): void {
    // Seçim modunda satır tıklaması profil açmaz; seçim checkbox ile yapılır
    if (this.bulkSendMode) return;
    this.selectedProfilePerson = person;
    this.showProfileModal = true;
  }

  onEditDialogClose(): void {
    this.editPerson = null;
  }

  onPersonSaved(): void {
    this.editPerson = null;
    this.fetchPersonList();
  }

  // Exit / Restore

  onExitDialogClose(): void {
    this.exitPerson = null;
  }

  onExitConfirmed(): void {
    this.exitPerson = null;
    this.fetchPersonList();
  }

  // Leave

  /** İzin Ata — satır tıklamasını tetiklemesin diye olay yayılımı durdurulur. */
  onLeaveRequest(event: Event, person: Person): void {
    event.stopPropagation();
    this.leavePerson = person;
    this.showLeaveDialog = true;
  }

  onLeaveDialogClose(): void {
    this.leavePerson = null;
  }

  onLeaveConfirmed(message: string): void {
    this.leavePerson = null;

    this.notification.success(message);

    this.fetchPersonList();
  }

  // Profile modal

  onLinkedPersonClick(person: Person): void {
    this.selectedProfilePerson = person;
  }

  onEditRequest(person: Person): void {
    this.showProfileModal = false;
    this.editPerson = person;
    this.showAddDialog = true;
  }

  onProfileExitRequest(person: Person): void {
    this.showProfileModal = false;
    this.exitPerson = person;
    this.exitMode = 'exit';
    this.showExitDialog = true;
  }

  onProfileRestoreRequest(person: Person): void {
    this.showProfileModal = false;
    this.exitPerson = person;
    this.exitMode = 'restore';
    this.showExitDialog = true;
  }

  onBusAssignRequest(event: Event, person: Person): void {
    event.stopPropagation();
    this.busAssignPerson = person;
    this.showBusAssignDialog = true;
  }

  onBusAssignDialogClose(): void {
    this.showBusAssignDialog = false;
    this.busAssignPerson = null;
  }
}
