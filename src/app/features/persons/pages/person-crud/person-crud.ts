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
import { unwrapResponse } from '../../../../shared/utils/response.utils';
import {
  Person,
  UserDef,
  getUserDefLabel,
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
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

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
    ToastModule,
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

  /** Tablo sütunları — userdef'a göre başlık override + export hook'ları uygulanır. */
  columns: ColumnDef<Person>[] = PERSON_COLUMNS.map((c) => ({ ...c }));

  /** Varsayılan görünür sütunlar (tablo tercihi olmadığında / sıfırlamada). */
  readonly PERSON_DEFAULT_FIELDS = PERSON_DEFAULT_FIELDS;

  private personService = inject(PersonService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.USERDEF = Number(this.route.snapshot.data['userDef']) as UserDef;
  }

  // ─── Derived labels ───

  get pageTitle(): string {
    return getUserDefLabel(this.USERDEF) + 'ler';
  }

  get addLabel(): string {
    return getUserDefLabel(this.USERDEF) + ' Ekle';
  }

  get formTitle(): string {
    return this.editPerson
      ? getUserDefLabel(this.USERDEF) + ' Düzenle'
      : 'Yeni ' + getUserDefLabel(this.USERDEF) + ' Ekle';
  }

  get descriptionText(): string {
    return (
      getUserDefLabel(this.USERDEF) +
      ' listesini buradan görüntüleyebilir ve yeni kayıt ekleyebilirsiniz.'
    );
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
      return [{ field: 'veliAdSoyad', header: 'Veliler' }]; // personelno yerine veliAdSoyad oldu
    }
    if (this.USERDEF === UserDef.Veli) {
      return [{ field: 'veliAdSoyad', header: 'Çocuklar' }]; // personelno yerine veliAdSoyad oldu
    }
    return [];
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

    // Veli sayfasında "Çocuklar" kolonu excel'e ad listesi olarak yazılsın
    if (this.USERDEF === UserDef.Veli) {
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

          // Veli sayfasında "Çocuklar" kolonu için ilişki haritasını kur
          if (this.USERDEF === UserDef.Veli) {
            this.loadChildrenMap();
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

  /**
   * Tüm veli-öğrenci ilişkilerini tek çağrıda çeker (sp_relationcampus_s, tip=0)
   * ve veliId → çocuk listesi haritası kurar. İsimler allPersons'tan çözülür.
   */
  private loadChildrenMap(): void {
    this.personService
      .getAllRelations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (relations) => {
          console.log('[Rel] getAllRelations satırları:', JSON.stringify(relations));
          this.childrenMap.clear();
          for (const rel of relations || []) {
            const veliId = Number(rel.VeliSicilId);
            const child = this.allPersons.find((p) => p.id === Number(rel.OgrenciSicilId));
            if (!child) {
              console.log('[Rel] eşleşmeyen satır → anahtarlar:', Object.keys(rel), '| VeliSicilId:', rel.VeliSicilId, '| OgrenciSicilId:', rel.OgrenciSicilId);
              continue;
            }
            if (!this.childrenMap.has(veliId)) this.childrenMap.set(veliId, []);
            this.childrenMap.get(veliId)!.push(child);
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

  /**
   * veliAdSoyad kolon hücresi:
   *   - Öğrenci sayfası → ilk veli adı (sp_sicilcampus_s TOP(1) sonucu)
   *   - Veli sayfası → çocuk adları (ilk 2 + kalan sayısı)
   */
  childrenSummary(p: Person): string {
    if (this.USERDEF !== UserDef.Veli) {
      return p.veliAdSoyad || '-';
    }
    const kids = this.childrenMap.get(p.id) ?? [];
    if (!kids.length) return '-';
    const names = kids.map((k) => k.adsoyad);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} daha`;
  }

  /** Veli satırında tüm çocuk adlarını tooltip olarak döndürür (boşsa null → tooltip yok). */
  childrenTooltip(p: Person): string | null {
    if (this.USERDEF !== UserDef.Veli) return null;
    const kids = this.childrenMap.get(p.id) ?? [];
    return kids.length ? kids.map((k) => k.adsoyad).join('\n') : null;
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

    this.messageService.add({
      severity: 'success',
      summary: 'Başarılı',
      detail: message,
      life: 3000,
    });

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
