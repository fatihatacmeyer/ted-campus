import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputMaskModule } from 'primeng/inputmask';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { Person, PersonInsertRequest, UserDef } from '../../../../core/models/person.model';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  ColumnDef,
  CustomizableTableComponent,
} from '../../../../shared/components/customizable-table/customizable-table';
import { unwrapResponse } from '../../../../shared/utils/response.utils';
import { PersonExitDialogComponent } from '../../../persons/components/person-exit-dialog/person-exit-dialog';
import { PersonService } from '../../../persons/services/person.service';
import { ServiceAuthority } from '../../models/school-bus.model';
import { BusStoreService } from '../../services/bus-store.service';
import { SchoolBusService } from '../../services/school-bus.service';
import { boldText } from '../../utils/transport.utils';

/** Yetkililer sekmesi: servis yetkilileri (sp_serviskullanicilarcampus_s), ekle/düzenle, çıkış, giriş bilgisi gönderme. */
@Component({
  selector: 'app-authorities-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputMaskModule,
    InputTextModule,
    TooltipModule,
    CustomizableTableComponent,
    PersonExitDialogComponent,
  ],
  templateUrl: './authorities-tab.html',
  styleUrl: './authorities-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthoritiesTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private busService = inject(SchoolBusService);
  private personService = inject(PersonService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private store = inject(BusStoreService);

  protected readonly serviceAuthorities = signal<ServiceAuthority[]>([]);
  protected readonly serviceAuthoritiesLoading = signal(false);

  /** Ekle/düzenle formu ve çıkış verme (ortak çıkış penceresi). */
  protected readonly authorityFormVisible = signal(false);
  protected readonly authorityEditing = signal<ServiceAuthority | null>(null);
  protected readonly authoritySaving = signal(false);
  protected readonly authorityLoadingId = signal<number | null>(null);
  /** Düzenlenen yetkilinin tam sicil kaydı: güncelleme tüm alanları yazdığı için korunur. */
  private authorityEditPerson: Person | null = null;
  protected authorityExitVisible = false;
  protected authorityExitPerson: Person | null = null;

  /** "Bilgileri Gönder" onayı. */
  protected readonly authoritySendVisible = signal(false);
  protected readonly authoritySendTarget = signal<ServiceAuthority | null>(null);
  protected readonly authoritySendLoading = signal(false);

  /**
   * Telefon p-inputMask ('0 (999) 999 99 99', unmask) ile girilir; değer baştaki 0 olmadan
   * 10 haneli gelir (kişi formuyla aynı). Eksik girişte maske değeri temizler.
   */
  protected readonly authorityForm: FormGroup = this.fb.group({
    ad: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
    soyad: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
    sicilno: ['', Validators.maxLength(20)],
    ceptelefon: ['', Validators.pattern(/^5\d{9}$/)],
    email: ['', [Validators.email, Validators.maxLength(100)]],
  });

  protected readonly serviceAuthorityColumns: ColumnDef<ServiceAuthority>[] = [
    { field: 'adSoyad', header: 'SCHOOL_BUS.COL_FULL_NAME', sortable: true, alwaysVisible: true },
    { field: 'sicilNo', header: 'SCHOOL_BUS.COL_REG_NO', sortable: true },
    { field: 'cepTelefon', header: 'SCHOOL_BUS.COL_PHONE' },
    { field: 'email', header: 'SCHOOL_BUS.COL_EMAIL', sortable: true },
  ];

  protected readonly bold = boldText;

  ngOnInit(): void {
    this.loadServiceAuthorities();
  }

  /** Esc: en üstte açık olan modalı kapatır. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.authorityFormVisible()) this.closeAuthorityForm();
    else if (this.authoritySendVisible()) this.closeAuthoritySend();
  }

  private loadServiceAuthorities(): void {
    this.serviceAuthoritiesLoading.set(true);
    this.busService
      .getServiceAuthorities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.serviceAuthorities.set(rows);
          this.serviceAuthoritiesLoading.set(false);
        },
        error: () => {
          this.notification.error('SCHOOL_BUS.MSG_AUTHORITIES_ERROR');
          this.serviceAuthoritiesLoading.set(false);
        },
      });
  }

  protected openAuthorityForm(row?: ServiceAuthority): void {
    if (!row) {
      this.authorityEditing.set(null);
      this.authorityEditPerson = null;
      this.authorityForm.reset({ ad: '', soyad: '', sicilno: '', ceptelefon: '', email: '' });
      this.authorityFormVisible.set(true);
      return;
    }

    // Liste prosedürü ad/soyadı ayrı vermediği için tam kayıt sicil listesinden alınır.
    this.authorityLoadingId.set(row.sicilId);
    this.personService
      .getPersonListCampus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (people) => {
          this.authorityLoadingId.set(null);
          const person = people.find((p) => p.id === row.sicilId);
          if (!person) {
            this.notification.error('SCHOOL_BUS.MSG_AUTHORITY_NOT_FOUND');
            return;
          }
          this.authorityEditing.set(row);
          this.authorityEditPerson = person;
          this.authorityForm.reset({
            ad: person.ad ?? '',
            soyad: person.soyad ?? '',
            sicilno: person.sicilno ?? '',
            ceptelefon: this.normalizePhone(person.ceptelefon),
            email: person.email ?? '',
          });
          this.authorityFormVisible.set(true);
        },
        error: () => {
          this.authorityLoadingId.set(null);
          this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR');
        },
      });
  }

  /** Kayıtlı telefonu maskenin beklediği 10 haneye çevirir (+90 / 90 / baştaki 0 atılır). */
  private normalizePhone(value: string | null | undefined): string {
    let digits = (value ?? '').replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length >= 12) digits = digits.substring(2);
    if (digits.startsWith('0')) digits = digits.substring(1);
    return digits;
  }

  protected closeAuthorityForm(): void {
    if (this.authoritySaving()) return;
    this.authorityFormVisible.set(false);
    this.authorityEditing.set(null);
    this.authorityEditPerson = null;
  }

  /** Backend tarihleri 'yyyy-MM-dd' bekler; datetime gelirse tarih kısmı alınır. */
  private dateOnly(value: string | null | undefined): string {
    return value ? (/^\d{4}-\d{2}-\d{2}/.exec(value)?.[0] ?? value) : '';
  }

  protected submitAuthority(): void {
    if (this.authoritySaving()) return;
    if (this.authorityForm.invalid) {
      this.authorityForm.markAllAsTouched();
      return;
    }

    const v = this.authorityForm.value;
    const form = {
      ad: String(v.ad).trim(),
      soyad: String(v.soyad).trim(),
      sicilno: String(v.sicilno ?? '').trim(),
      ceptelefon: String(v.ceptelefon ?? '').trim(),
      email: String(v.email ?? '').trim(),
    };

    const editing = this.authorityEditing();
    const original = this.authorityEditPerson;
    let request$;
    if (editing && original) {
      // Güncelleme tam kayıt yazar: formda olmayan alanlar mevcut değerleriyle gönderilir.
      const payload: PersonInsertRequest & { id: number } = {
        id: original.id,
        userdef: UserDef.Authority,
        personelno: original.personelno ?? '',
        cardid: original.cardid ?? '',
        telefon1: original.telefon1 ?? '',
        adres: original.adres ?? '',
        il: original.il ?? '',
        ilce: original.ilce ?? '',
        cinsiyet: original.cinsiyet ?? '',
        kangrubu: original.kangrubu ?? '',
        firma: original.firma ?? '',
        bolum: original.bolum ?? '',
        pozisyon: original.pozisyon ?? '',
        gorev: original.gorev ?? '',
        altfirma: original.altfirma ?? '',
        direktorluk: original.direktorluk ?? '',
        yaka: original.yaka ?? '',
        okod1: original.okod1 ?? '',
        dogumtarih: this.dateOnly(original.dogumtarih),
        giristarih: this.dateOnly(original.giristarih),
        ...form,
      };
      request$ = this.personService.updatePerson(payload);
    } else {
      request$ = this.personService.insertPerson({ ...form, userdef: UserDef.Authority });
    }

    this.authoritySaving.set(true);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.authoritySaving.set(false);
        const result = unwrapResponse<Person>(res);
        // islemsonuc negatifse backend işlemi reddetmiştir.
        if (result && Number(result.islemsonuc) < 0) {
          this.notification.error(result.sunucucevap || 'SCHOOL_BUS.MSG_OP_ERROR');
          return;
        }
        this.notification.success(
          editing ? 'SCHOOL_BUS.MSG_AUTHORITY_UPDATED' : 'SCHOOL_BUS.MSG_AUTHORITY_ADDED',
        );
        this.authorityFormVisible.set(false);
        this.authorityEditing.set(null);
        this.authorityEditPerson = null;
        this.afterAuthorityChange();
      },
      error: () => {
        this.authoritySaving.set(false);
        this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR');
      },
    });
  }

  /** Çıkış: kişi ortak çıkış penceresiyle (neden + tarih) ayrılır. */
  protected openAuthorityExit(row: ServiceAuthority): void {
    // Çıkış penceresi yalnızca id ve görünen adı kullanır.
    this.authorityExitPerson = { id: row.sicilId, ad: row.adSoyad, soyad: '' } as Person;
    this.authorityExitVisible = true;
  }

  protected onAuthorityExitVisibleChange(visible: boolean): void {
    this.authorityExitVisible = visible;
    if (!visible) this.authorityExitPerson = null;
  }

  protected afterAuthorityChange(): void {
    this.loadServiceAuthorities();
    // Atamalar sekmesindeki yetkili seçenekleri bir sonraki açılışta yeniden yüklensin.
    this.store.invalidateAuthorities();
  }

  protected confirmAuthoritySend(row: ServiceAuthority): void {
    this.authoritySendTarget.set(row);
    this.authoritySendVisible.set(true);
  }

  protected closeAuthoritySend(): void {
    if (this.authoritySendLoading()) return;
    this.authoritySendVisible.set(false);
    this.authoritySendTarget.set(null);
  }

  /** Giriş bilgilerini yeniden gönderir (mevcut giriş kaydı silinir, yenisi iletilir). */
  protected sendAuthorityLogin(): void {
    const target = this.authoritySendTarget();
    if (!target || this.authoritySendLoading()) return;

    this.authoritySendLoading.set(true);
    this.busService
      .sendAuthorityLogin(target.sicilId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.authoritySendLoading.set(false);
          if (res.sonuc === 1) {
            this.notification.success(res.sunucuCevap || 'SCHOOL_BUS.MSG_INFO_SENT');
          } else {
            this.notification.error(res.sunucuCevap || 'SCHOOL_BUS.MSG_INFO_SEND_ERROR');
          }
          this.authoritySendVisible.set(false);
          this.authoritySendTarget.set(null);
        },
        error: () => {
          this.authoritySendLoading.set(false);
          this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR');
        },
      });
  }
}
