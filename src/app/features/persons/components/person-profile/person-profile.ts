import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import {
  Person,
  LinkedPerson,
  UserDef,
} from '../../../../core/models/person.model';

@Component({
  selector: 'app-person-profile',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './person-profile.html',
  styleUrl: './person-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonProfileComponent {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Input() allPersons: Person[] = [];
  @Input() userdefContext = UserDef.Ogrenci;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() personClick = new EventEmitter<Person>();
  @Output() editRequest = new EventEmitter<Person>();
  @Output() exitRequest = new EventEmitter<Person>();
  @Output() restoreRequest = new EventEmitter<Person>();

  get linkedPersons(): LinkedPerson[] {
    // 1. Kişi yoksa veya backend'den veliSicilId gelmemişse boş liste dön.
    if (!this.person || !this.person.veliSicilId) return [];

    const veliId = Number(this.person.veliSicilId);

    // 2. Tıklanabilir (link) yapabilmek için, bu veliyi allPersons (tüm kişiler) listesinde arıyoruz.
    const found = this.allPersons.find((p) => p.id === veliId);

    if (found) {
      return [{ id: found.id, name: found.adsoyad, sicilno: found.sicilno }];
    }

    // 3. Eğer allPersons içinde bulamazsa (ya da liste yüklenmemişse), backend'in doğrudan verdiği VeliAdSoyad metnini göster.
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

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
