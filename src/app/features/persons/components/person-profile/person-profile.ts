import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  inject,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Person, LinkedPerson, UserDef } from '../../../../core/models/person.model';
import { ApiHelperService } from '../../../../core/services/api-helper.service';
import { AppConfig, APP_CONFIG } from '../../../../core/services/app-config.service';

@Component({
  selector: 'app-person-profile',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './person-profile.html',
  styleUrl: './person-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonProfileComponent implements OnChanges {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Input() allPersons: Person[] = [];
  @Input() childrenMap: Map<number, Person[]> = new Map();
  @Input() parentsMap: Map<number, Person[]> = new Map();
  @Input() userdefContext = UserDef.Ogrenci;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() personClick = new EventEmitter<Person>();
  @Output() editRequest = new EventEmitter<Person>();
  @Output() exitRequest = new EventEmitter<Person>();
  @Output() restoreRequest = new EventEmitter<Person>();
  @Output() forgotPasswordRequest = new EventEmitter<Person>();

  private api = inject(ApiHelperService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private config: AppConfig = inject(APP_CONFIG);

  showFullPhoto = false;
  photoUrl: string | null = null;
  photoFailed = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Farklı bir kişiye tıklandığında veya modal açıldığında hata durumunu sıfırlıyoruz
    if (changes['person']) {
      this.photoFailed = false;
      this.photoUrl = null;
      this.loadProfilePhoto();
    }
  }

  private loadProfilePhoto(): void {
    if (!this.person) return;

    const isVekil = this.person.userdefad === 'Vekil';

    this.api
      .callEndpoint<any[]>('Dynamic', {
        point: 'ProfilFotografCampus',
        islemtipi: 's',
        SicilId: isVekil ? '' : this.person.id,
        VekilCampusId: isVekil ? this.person.id : '',
        OnayDurumu: 1,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (rows && rows.length > 0 && rows[0].DosyaAdi) {
            // Konfigürasyondan gelen dinamik URL'i kullanıyoruz
            const baseUrl =
              this.config.photoBaseUrl || 'http://localhost/MeCampus/ProfilFotograflari';
            this.photoUrl = `${baseUrl}/${rows[0].DosyaAdi}`;

            console.log('Oluşturulan Resim URLsi:', this.photoUrl);
          } else {
            this.photoFailed = true;
          }

          this.cdr.markForCheck();
        },
        error: () => {
          this.photoFailed = true;
          this.cdr.markForCheck();
        },
      });
  }
  onPhotoError(): void {
    this.photoFailed = true;
  }

  get linkedPersons(): LinkedPerson[] {
    if (!this.person) return [];

    const ctx = this.person.userdef ?? this.userdefContext;

    // Veli profili → çocuklar; childrenMap (sp_relationcampus_s tip=0) üzerinden çözülür.
    // NOT: veli satırlarında VeliSicilId null gelir (yalnızca öğrenci satırlarında dolu),
    // o yüzden veli dalı childrenMap'e bakmak zorundadır.
    if (ctx === UserDef.Veli) {
      const kids = this.childrenMap.get(this.person.id) ?? [];
      return kids.map((k) => ({ id: k.id, name: k.adsoyad, sicilno: k.sicilno }));
    }

    // Öğrenci profili → veliler; parentsMap (sp_relationcampus_s tip=0) üzerinden çözülür.
    // Tüm veliler gelir (sicilcampus yalnızca TOP(1) ilk veliyi döndürür).
    const parents = this.parentsMap.get(this.person.id) ?? [];
    if (parents.length) {
      return parents.map((p) => ({ id: p.id, name: p.adsoyad, sicilno: p.sicilno }));
    }

    // Harita boşsa (ilişki verisi yüklenmemişse) eski davranışa düş:
    // veliSicilId üzerinden tek veli (sp_sicilcampus_s TOP(1) sonucu).
    if (!this.person.veliSicilId) return [];

    const veliId = Number(this.person.veliSicilId);

    // Tıklanabilir (link) yapabilmek için, bu veliyi allPersons (tüm kişiler) listesinde arıyoruz.
    const found = this.allPersons.find((p) => p.id === veliId);

    if (found) {
      return [{ id: found.id, name: found.adsoyad, sicilno: found.sicilno }];
    }

    // Eğer allPersons içinde bulamazsa (ya da liste yüklenmemişse), backend'in doğrudan verdiği VeliAdSoyad metnini göster.
    return [
      {
        id: veliId,
        name: this.person.veliAdSoyad || 'Bilinmeyen Veli',
        sicilno: '',
      },
    ];
  }

  /** Öğrenci (UserDef.Ogrenci) ise veliler görünür */
  get showLinkedPersons(): boolean {
    const ctx = this.person?.userdef ?? this.userdefContext;
    return ctx === UserDef.Ogrenci || ctx === UserDef.Veli;
  }

  /** Dinamik label — tıklanan kişinin userdef değerine göre */
  get linkedPersonsLabel(): string {
    const ctx = this.person?.userdef ?? this.userdefContext;
    if (ctx === UserDef.Ogrenci) return 'Veliler';
    if (ctx === UserDef.Veli) return 'Çocuklar';
    return 'Bağlantılı Kişiler';
  }

  get hasLinkedPersons(): boolean {
    return this.linkedPersons.length > 0;
  }

  onLinkedPersonClick(linked: LinkedPerson): void {
    const found = this.allPersons.find((p) => p.id === linked.id);

    if (found) {
      // Eğer ana listede bulursa tüm verileriyle modalı aç
      this.personClick.emit(found);
    } else {
      // Eğer listede bulamazsa (API'den gelmemişse), elimizdeki isim ve ID ile
      // modalı en azından temel bilgilerle açması için sahte (kısmi) bir profil fırlatıyoruz.
      const fallbackPerson = {
        id: linked.id,
        adsoyad: linked.name,
        ad: linked.name,
        soyad: '',
        sicilno: linked.sicilno || '',
        userdefad: 'Veli',
        ceptelefon: '',
        cardid: '',
      } as Person;

      this.personClick.emit(fallbackPerson);
    }
  }

  onEditClick(): void {
    if (this.person) {
      this.editRequest.emit(this.person);
    }
  }

  get isPersonActive(): boolean {
    return this.person ? !this.person.cikistarih : false;
  }

  onExitClick(): void {
    if (this.person) {
      this.exitRequest.emit(this.person);
    }
  }

  onRestoreClick(): void {
    if (this.person) {
      this.restoreRequest.emit(this.person);
    }
  }

  onForgotPasswordClick(): void {
    if (this.person) {
      // Şimdilik sadece event fırlatıyoruz, prosedür bağlantısı parent component'te (veya burada servise bağlanarak) yapılacak.
      this.forgotPasswordRequest.emit(this.person);
    }
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  get isProxyPerson(): boolean {
    return this.person?.userdefad === 'Vekil';
  }
}
