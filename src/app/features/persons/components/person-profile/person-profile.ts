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
import { TooltipModule } from 'primeng/tooltip';
import { Person, LinkedPerson, UserDef } from '../../../../core/models/person.model';
import { ApiHelperService } from '../../../../core/services/api-helper.service';
import { AppConfig, APP_CONFIG } from '../../../../core/services/app-config.service';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SmsLogDialogComponent } from '../sms-log-dialog/sms-log-dialog';

@Component({
  selector: 'app-person-profile',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    ConfirmDialogModule,
    TooltipModule,
    TranslatePipe,
    SmsLogDialogComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './person-profile.html',
  styleUrl: './person-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonProfileComponent implements OnChanges {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Input() allPersons: Person[] = [];
  @Input() childrenMap = new Map<number, Person[]>();
  @Input() parentsMap = new Map<number, Person[]>();
  @Input() userdefContext = UserDef.Ogrenci;
  @Input() kind: 'sicil' | 'vekil' = 'sicil';

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
  private confirmationService = inject(ConfirmationService);
  private translate = inject(TranslateService);

  showFullPhoto = false;
  showSmsLog = false;
  photoUrl: string | null = null;
  photoFailed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['person']) {
      this.showSmsLog = false;
      this.photoFailed = false;
      this.photoUrl = null;
      this.loadProfilePhoto();
    }
  }

  get isStudent(): boolean {
    const ctx = this.person?.userdef ?? this.userdefContext;
    return ctx === UserDef.Ogrenci;
  }

  private loadProfilePhoto(): void {
    if (!this.person) return;

    const isVekil = this.isProxyPerson;

    this.api
      .callEndpoint<{ DosyaAdi?: string }[]>('Dynamic', {
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

    if (ctx === UserDef.Veli) {
      const kids = this.childrenMap.get(this.person.id) ?? [];
      return kids.map((k) => ({ id: k.id, name: k.adsoyad, sicilno: k.sicilno }));
    }

    const parents = this.parentsMap.get(this.person.id) ?? [];
    if (parents.length) {
      return parents.map((p) => ({ id: p.id, name: p.adsoyad, sicilno: p.sicilno }));
    }

    if (!this.person.veliSicilId) return [];

    const veliId = Number(this.person.veliSicilId);

    const found = this.allPersons.find((p) => p.id === veliId);

    if (found) {
      return [{ id: found.id, name: found.adsoyad, sicilno: found.sicilno }];
    }

    return [
      {
        id: veliId,
        name: this.person.veliAdSoyad || 'Bilinmeyen Veli',
        sicilno: '',
      },
    ];
  }

  get showLinkedPersons(): boolean {
    const ctx = this.person?.userdef ?? this.userdefContext;
    return ctx === UserDef.Ogrenci || ctx === UserDef.Veli;
  }

  get linkedPersonsLabel(): string {
    const ctx = this.person?.userdef ?? this.userdefContext;
    if (ctx === UserDef.Ogrenci) return 'PERSON_PROFILE.LINKED_PARENTS';
    if (ctx === UserDef.Veli) return 'PERSON_PROFILE.LINKED_CHILDREN';
    return 'PERSON_PROFILE.LINKED_DEFAULT';
  }

  get hasLinkedPersons(): boolean {
    return this.linkedPersons.length > 0;
  }

  onLinkedPersonClick(linked: LinkedPerson): void {
    const found = this.allPersons.find((p) => p.id === linked.id);

    if (found) {
      this.personClick.emit(found);
    } else {
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
      this.confirmationService.confirm({
        message: this.translate.instant('PERSON_PROFILE.CONFIRM_SEND', {
          name: `<strong>${this.person.adsoyad}</strong>`,
        }),
        header: this.translate.instant('PERSON_PROFILE.CONFIRM_SEND_TITLE'),
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: this.translate.instant('PERSON_PROFILE.YES_SEND'),
        rejectLabel: this.translate.instant('COMMON.CANCEL'),
        acceptButtonStyleClass: 'p-button-success',
        rejectButtonStyleClass: 'p-button-text p-button-danger',
        accept: () => {
          this.forgotPasswordRequest.emit(this.person!);
        },
      });
    }
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  get isProxyPerson(): boolean {
    return this.kind === 'vekil';
  }
}
