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
import { unwrapResponse, isSuccessResult } from '../../../../shared/utils/response.utils';
import {
  Person,
  UserDef,
  getUserDefLabel,
  getUserDefLabelKey,
} from '../../../../core/models/person.model';
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
import { TranslatePipe } from '@ngx-translate/core';
import { OperationResultResponse } from '../../../../core/models/person.model';

@Component({
  selector: 'app-person-crud',
  standalone: true,
  imports: [
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

  /** Veli sayfası: veliId → çocukları (sp_relationcampus_s tip=0'dan tek çağrıda kurulur). */
  childrenMap = new Map<number, Person[]>();

  /** Öğrenci sayfası: ogrenciId → velileri (aynı getAllRelations çağrısında kurulur). */
  parentsMap = new Map<number, Person[]>();

  /** Tablo sütunları — userdef'a göre başlık override + export hook'ları uygulanır. */
  columns: ColumnDef<Person>[] = PERSON_COLUMNS.map((c) => ({ ...c }));

  /** Varsayılan görünür sütunlar (tablo tercihi olmadığında / sıfırlamada). */
  readonly PERSON_DEFAULT_FIELDS = PERSON_DEFAULT_FIELDS;

  private personService = inject(PersonService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.USERDEF = Number(this.route.snapshot.data['userDef']) as UserDef;
  }

  // ─── Derived labels ───

  get pageTitleKey(): string {
    return getUserDefLabelKey(this.USERDEF) + '_PLURAL';
  }

  get addLabelKey(): string {
    return 'PERSON.ADD_' + getUserDefLabelKey(this.USERDEF).split('.')[1];
  }

  get formTitleKey(): string {
    return this.editPerson
      ? 'PERSON.EDIT_' + getUserDefLabelKey(this.USERDEF).split('.')[1]
      : 'PERSON.ADD_' + getUserDefLabelKey(this.USERDEF).split('.')[1];
  }

  get descriptionTextKey(): string {
    return 'PERSON.LIST_DESCRIPTION';
  }

  /** Tüm personel tiplerinde profil modalı gösterilir. */
  readonly hasProfileModal = true;

  /** İşlem kolu sadece Ogrenci sayfasında gösterilir (İzin Ata). */
  get showActionsColumn(): boolean {
    return this.USERDEF === UserDef.Ogrenci;
  }

  /** Ogrenci ve Veli sayfalarında allPersons gereklidir. */
  get needsAllPersons(): boolean {
    return this.USERDEF !== UserDef.Ogretmen;
  }

  /** Tablo sütun başlıkları — userdef'a göre farklılık gösterir. */
  get columnOverrides(): { field: string; header: string }[] {
    if (this.USERDEF === UserDef.Ogrenci) {
      return [
        { field: 'veliAdSoyad', header: 'Veliler' },
        { field: 'firmaad', header: 'Kampüs' },
        { field: 'bolumad', header: 'Sınıf' },
        { field: 'direktorlukad', header: 'Eğitim Düzeyi' },
      ];
    }
    if (this.USERDEF === UserDef.Veli) {
      return [{ field: 'veliAdSoyad', header: 'Çocuklar' }];
    }
    if (this.USERDEF === UserDef.Ogretmen) {
      return [
        { field: 'firmaad', header: 'Kampüs' },
        { field: 'bolumad', header: 'Zümre / Bölüm' },
        { field: 'pozisyonad', header: 'Branş' },
        { field: 'personelno', header: 'Personel No' },
      ];
    }
    return [];
  }

  /** Tablo ilk açıldığında veya varsayılanlara dönüldüğünde gösterilecek sütunlar. */
  get currentDefaultFields(): string[] {
    if (this.USERDEF === UserDef.Ogrenci) {
      // Ad, Soyad, Kampüs, Sınıf, Telefon, Eğitim Düzeyi, Veliler, Sicil No, Personel No, Pozisyon
      return ['ad', 'soyad', 'firmaad', 'bolumad', 'ceptelefon', 'direktorlukad', 'veliAdSoyad'];
    }

    if (this.USERDEF === UserDef.Veli) {
      // Veli ekranı için mantıklı olan varsayılanlar
      return ['ad', 'soyad', 'ceptelefon', 'veliAdSoyad'];
    }

    if (this.USERDEF === UserDef.Ogretmen) {
      // Öğretmen ekranı için mantıklı olan varsayılanlar
      return ['ad', 'soyad', 'personelno', 'firmaad', 'bolumad', 'pozisyonad', 'ceptelefon'];
    }

    return this.PERSON_DEFAULT_FIELDS;
  }

  // ─── Column config ───

  private applyColumnOverrides(): void {
    for (const override of this.columnOverrides) {
      const col = this.columns.find((c) => c.field === override.field);
      if (col) col.header = override.header;
    }
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

  // ─── Lifecycle ───

  ngOnInit() {
    this.applyColumnOverrides();
    this.applyExportHooks();
    this.fetchPersonList();
  }

  // ─── Data ───

  fetchPersonList(): void {
    this.isLoading = true;
    this.errorMessage = '';

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
          this.errorMessage = 'Sistem hatası: Personel listesi sunucudan çekilemedi.';
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
          // 1. Eşleştirme için allPersons dizisini hızlı erişilebilir bir Map'e çeviriyoruz O(N)
          const personLookup = new Map<number, Person>();
          for (const p of this.allPersons) {
            personLookup.set(p.id, p);
          }

          this.childrenMap.clear();
          this.parentsMap.clear();

          // 2. Döngü içinde array.find() yerine lookup.get() kullanıyoruz O(1)
          for (const rel of relations || []) {
            const veliId = Number(rel.VeliSicilId);
            const ogrenciId = Number(rel.OgrenciSicilId);

            // HIZLANDIRILMIŞ KISIM:
            // this.allPersons.find(p => p.id === ...) yerine direkt erişim:
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
    // Sadece öğrenci ve veli için geçerli kısıtlaması
    if (this.USERDEF !== UserDef.Ogrenci && this.USERDEF !== UserDef.Veli) {
      this.notification.error('Bu işlem sadece öğrenci ve veliler için geçerlidir.');
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    this.personService
      .sendPasswordReminder(person.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isLoading = false;

          // Dizi olarak gelen yanıtı tekil nesneye indirgiyoruz
          const result = unwrapResponse<any>(response);

          console.log(result);

          // Prosedür güncellendiği için artık projenin standart helper'ını kullanabiliriz
          if (result && (result.Sonuc === 1 || result.Sonuc === '1')) {
            this.notification.success(result.sunucucevap || 'Kullanıcı silindi.');
          } else {
            this.notification.error(result?.sunucucevap || 'Kullanıcı bulunamadı veya silinemedi.');
          }

          this.showProfileModal = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.notification.error('Sunucuyla iletişim kurulurken hata oluştu.');
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

  // ─── Dialog open / close ───

  openAddDialog(): void {
    this.editPerson = null;
    this.showAddDialog = true;
  }

  onRowClick(person: Person): void {
    this.selectedProfilePerson = person;
    this.showProfileModal = true;
  }

  onEditDialogClose(): void {
    this.editPerson = null;
  }

  onPersonSaved(response: unknown): void {
    const personData = unwrapResponse(response) as Person;

    this.editPerson = null;
    this.fetchPersonList();
  }

  // ─── Exit / Restore ───

  onExitDialogClose(): void {
    this.exitPerson = null;
  }

  onExitConfirmed(): void {
    this.exitPerson = null;
    this.fetchPersonList();
  }

  // ─── Leave ───

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

  // ─── Profile modal ───

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
}
