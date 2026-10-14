import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlContainer, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { concat, Observable, of } from 'rxjs';

import { Person, RelationCampusRow, UserDef } from '../../../../core/models/person.model';
import { PersonService } from '../../services/person.service';
import { linkedKindKey, linkedTargetUserdef } from '../../utils/linked-person.utils';

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

/**
 * Kişi formunun "Veli / Çocuk Bilgisi" bölümü (öğrenci ↔ veli ilişkisi).
 * Ekleme, değiştirme ve silme işlemleri burada biriktirilir; kişi kaydedildikten sonra
 * üst form `applyRelationOps(personId)` ile sırayla uygular.
 *
 * Alanlar üst formun `FormGroup`'una bağlıdır (linkedPersonId, changeLinkedId, yeniLinked*).
 */
@Component({
  selector: 'app-person-linked-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TooltipModule,
  ],
  // formControlName'lerin üst formdaki <form [formGroup]>'a bağlanması için.
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true }),
    },
  ],
  templateUrl: './person-linked-section.html',
  styleUrl: './person-linked-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonLinkedSectionComponent implements OnChanges {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) userdef!: number;
  @Input() allPersons: Person[] = [];
  @Input() isEditMode = false;
  /** Düzenlenen kişinin id'si; doluysa mevcut ilişkiler yüklenir. */
  @Input() personId: number | null = null;

  private personService = inject(PersonService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  isCreatingNewLinked = false;

  existingRelations: ExistingRelation[] = []; // DB'deki mevcut ilişkiler
  removedRelIds: number[] = []; // silinecek ilişkiler (sp_velicampus_d)
  changedRelations: RelationChange[] = []; // velisi değişecek ilişkiler (sp_velicampus_u)
  pendingAdditions: number[] = []; // eklenecek veli sicil id'leri (sp_velicampus_i)
  changingRelid: number | null = null; // "Değiştir" modundaki satırın relid'si
  confirmRemoveKey: string | null = null; // "Kaldır" onayı bekleyen satır

  /**
   * linkedPersonOptions cache'i — getter her change detection'da çağrıldığı için
   * binlerce kayıtlık allPersons listesini her seferinde yeniden filtreleyip
   * map'lememek adına, girdiler (allPersons/ilişki durumu/userdef) değişmedikçe
   * sonuç burada tutulur. Geçersiz kılma: invalidateLinkedOptions().
   */
  private cachedLinkedOptions: { label: string; value: number }[] | null = null;

  private invalidateLinkedOptions(): void {
    this.cachedLinkedOptions = null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // linkedPersonOptions girdileri değişti → cache'i tazele
    if (changes['allPersons'] || changes['userdef']) {
      this.invalidateLinkedOptions();
    }
    if (changes['personId']) {
      this.resetRelationState();
      // Düzenleme modunda mevcut ilişkileri ilişki tablosundan yükle (öğrenci: tip=2, veli: tip=1)
      if (this.personId) this.loadExistingRelations(this.personId);
    }
  }

  /** İlişkili kişinin tekil adı (i18n anahtarı): öğrenci düzenlerken "Veli", veli düzenlerken "Öğrenci". */
  get linkedKind(): string {
    return linkedKindKey(this.userdef);
  }

  /** Bölüm başlığı (i18n anahtarı): "Veli Bilgisi" / "Çocuk Bilgisi". */
  get linkedSectionTitle(): string {
    return this.userdef === UserDef.Veli ? 'PERSON.CHILD_INFO' : 'PERSON.PARENT_INFO';
  }

  /** Toggle buton etiketi (i18n anahtarı): "Listeden Seç" / "Yeni Veli Oluştur" / "Yeni Öğrenci Oluştur". */
  get newLinkedToggleLabel(): string {
    return this.isCreatingNewLinked ? 'PERSON.SELECT_FROM_LIST' : 'PERSON.CREATE_NEW_LINKED';
  }

  /** "Veli seçin" / "Öğrenci seçin" placeholder'ı (i18n anahtarı). */
  readonly linkedSelectPlaceholder = 'PERSON.SELECT_LINKED';

  /** Değiştir dropdown'ı placeholder'ı (i18n anahtarı): "Yeni veli seçin" / "Yeni öğrenci seçin". */
  readonly changeLinkedPlaceholder = 'PERSON.SELECT_NEW_LINKED';

  /** "Veli Ekle" / "Öğrenci Ekle" buton etiketi (i18n anahtarı). */
  readonly addLinkedButtonLabel = 'PERSON.ADD_LINKED';

  /** Değiştir tooltip'i (i18n anahtarı): "Veliyi Değiştir" / "Öğrenciyi Değiştir". */
  get changeLinkedTooltip(): string {
    return this.userdef === UserDef.Veli ? 'PERSON.CHANGE_STUDENT' : 'PERSON.CHANGE_PARENT';
  }

  /** Kaldır tooltip'i (i18n anahtarı): "Veli İlişkisini Kaldır" / "Öğrenci İlişkisini Kaldır". */
  get removeLinkedTooltip(): string {
    return this.userdef === UserDef.Veli
      ? 'PERSON.REMOVE_STUDENT_RELATION'
      : 'PERSON.REMOVE_PARENT_RELATION';
  }

  /** Boş liste metni (i18n anahtarı): "Veli atanmamış" / "Çocuk atanmamış". */
  get noLinkedText(): string {
    return this.userdef === UserDef.Veli ? 'PERSON.NO_STUDENT' : 'PERSON.NO_PARENT';
  }

  /** Dropdown içindeki arama kutusu placeholder'ı (i18n anahtarı): "Veli ara..." / "Öğrenci ara...". */
  readonly linkedFilterPlaceholder = 'PERSON.SEARCH_LINKED';

  get linkedPersonOptions(): { label: string; value: number }[] {
    if (this.cachedLinkedOptions) return this.cachedLinkedOptions;

    // userdef=Ogrenci → show userdef=Veli, userdef=Veli → show userdef=Ogrenci
    const targetUserdef = linkedTargetUserdef(this.userdef);

    // Zaten ilişkili olan velileri dropdown'dan çıkar (mükerrer ilişki oluşmasın):
    // - mevcut ilişkiler (kaldırılmamış olanlar)
    // - bekleyen eklemeler
    const excludedIds = new Set<number>();
    for (const rel of this.existingRelations) {
      if (!this.removedRelIds.includes(rel.relid)) excludedIds.add(rel.linkedId);
    }
    for (const linkedId of this.pendingAdditions) excludedIds.add(linkedId);

    this.cachedLinkedOptions = this.allPersons
      .filter((p) => p.userdef === targetUserdef && !excludedIds.has(p.id))
      .map((p) => ({ label: `${p.adsoyad} (${p.sicilno ? p.sicilno : p.id})`, value: p.id }));
    return this.cachedLinkedOptions;
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

  /** Yeni kişi oluşturma modundan çıkar (üst form, yeni kişiyi kaydettikten sonra çağırır). */
  stopCreatingNew(): void {
    this.isCreatingNewLinked = false;
    this.cdr.markForCheck();
  }

  // ─── Veli ilişkisi yönetimi (sp_relationcampus_s / sp_velicampus_i-u-d) ───

  /**
   * Düzenleme modunda mevcut ilişkileri yükler:
   *  - öğrenci düzenlerken sp_relationcampus_s tip=2 (velileri) → { VeliSicilId, relid }
   *  - veli düzenlerken sp_relationcampus_s tip=1 (çocukları) → { OgrenciSicilId, relid }
   */
  private loadExistingRelations(personId: number): void {
    const ogrenciModu = this.userdef === UserDef.Ogrenci;
    const obs = ogrenciModu
      ? this.personService.getStudentRelation(personId)
      : this.personService.getParentRelations(personId);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows: RelationCampusRow[]) => {
        this.existingRelations = (rows || []).map((r) => {
          const linkedId = Number(ogrenciModu ? r.VeliSicilId : r.OgrenciSicilId);
          const relid = Number(r.relid ?? r.Id);
          const linked = this.allPersons.find((p) => p.id === linkedId);
          return {
            relid,
            linkedId,
            linkedName: linked ? linked.adsoyad : `${this.linkedKind} #${linkedId}`,
            sicilno: linked?.sicilno ?? '',
          };
        });
        this.invalidateLinkedOptions();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[PersonForm] Mevcut ilişkiler yüklenemedi:', err);
        this.existingRelations = [];
        this.invalidateLinkedOptions();
        this.cdr.markForCheck();
      },
    });
  }

  resetRelationState(): void {
    this.existingRelations = [];
    this.removedRelIds = [];
    this.changedRelations = [];
    this.pendingAdditions = [];
    this.changingRelid = null;
    this.confirmRemoveKey = null;
    this.isCreatingNewLinked = false;
    this.invalidateLinkedOptions();
    this.cdr.markForCheck();
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

  /** Bekleyen eklemelere kişi ekler (üst form kayıt sırasında da çağırır). */
  addPendingLinked(linkedId: number): void {
    if (this.pendingAdditions.includes(linkedId)) return;
    this.pendingAdditions.push(linkedId);
    this.invalidateLinkedOptions();
    this.cdr.markForCheck();
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
    this.invalidateLinkedOptions();

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
    this.invalidateLinkedOptions();
    this.cdr.markForCheck();
  }

  /**
   * Bekleyen ilişki değişikliklerini sırayla uygular (kişi kaydedildikten sonra):
   *   1. silmeler  → sp_velicampus_d (relid)
   *   2. değişimler → sp_velicampus_u (relid ile — relid eksikse SP sessizce hiçbir satırı güncellemez)
   *   3. eklemeler → sp_velicampus_i (veli sicil id)
   */
  applyRelationOps(personId: number): Observable<unknown> {
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
}
