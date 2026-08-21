import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  DestroyRef,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import {
  CustomizableTableComponent,
  ColumnDef,
  ColumnCellDirective,
} from '../../../../shared/components/customizable-table/customizable-table';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProxyService } from '../../services/proxy.service';
import { GuardianProxy, ProxyApprovalStatus } from '../../../../core/models/proxy.model';
import { PersonProfileComponent } from '../../components/person-profile/person-profile';
import { Person } from '../../../../core/models/person.model';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

interface TabOption {
  label: string;
  status: ProxyApprovalStatus | null;
}

@Component({
  selector: 'app-proxy-list',
  standalone: true,
  imports: [
    CommonModule,
    CustomizableTableComponent,
    ColumnCellDirective,
    ButtonModule,
    TagModule,
    TooltipModule,
    TranslatePipe,
    PersonProfileComponent,
    FormsModule,
    ToggleSwitchModule,
  ],
  templateUrl: './proxy-list.html',
  styleUrl: './proxy-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProxyListComponent implements OnInit {
  private proxyService = inject(ProxyService);
  private notification = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  proxies: GuardianProxy[] = [];
  isLoading = false;

  readonly ProxyApprovalStatus = ProxyApprovalStatus;

  showProfileModal = false;
  selectedProfilePerson: Person | null = null;

  onRowClick(proxy: GuardianProxy): void {
    // Vekil verisini Person modeline uyarlayarak profile gönderiyoruz.
    // userdefad alanına 'Vekil' yazıyoruz ki modal içinde bunun vekil olduğunu anlayalım.
    this.selectedProfilePerson = {
      id: proxy.id, // Bu aslında VekilCampusId
      adsoyad: proxy.vekilAdSoyad,
      ad: proxy.vekilAdSoyad,
      soyad: '',
      sicilno: proxy.vekilTC,
      userdefad: 'Vekil',
      ceptelefon: proxy.vekilTelefon,
      cardid: '',
      userdef: -1,
    } as Person;

    this.showProfileModal = true;
  }

  // --- Filtre Sekmeleri (PDKS mantığı) ---
  activeTab = signal<ProxyApprovalStatus | null>(null);

  tabOptions: TabOption[] = [
    { label: 'Hepsi', status: null },
    { label: 'Onaylandı', status: ProxyApprovalStatus.Approved },
    { label: 'Bekliyor', status: ProxyApprovalStatus.Pending },
    { label: 'Reddedildi', status: ProxyApprovalStatus.Rejected },
  ];

  columns: ColumnDef<GuardianProxy>[] = [
    { field: 'ogrenciAdSoyad', header: 'Öğrenci', sortable: true, alwaysVisible: true },
    { field: 'veliAdSoyad', header: 'Veli', sortable: true },
    { field: 'vekilAdSoyad', header: 'Vekil', sortable: true, alwaysVisible: true },
    { field: 'vekilTC', header: 'TC Kimlik', sortable: true },
    { field: 'vekilTelefon', header: 'Telefon' },
    { field: 'yakinlik', header: 'Yakınlık' },
    { field: 'basTarih', header: 'Başlangıç' },
    { field: 'bitTarih', header: 'Bitiş' },
    { field: 'onayDurumu', header: 'Durum', sortable: true },
  ];

  ngOnInit(): void {
    this.loadProxies();
  }

  // Aktif sekmeyi güncelleyip veriyi yeniden çeker
  onTabChange(status: ProxyApprovalStatus | null): void {
    this.activeTab.set(status);
    this.loadProxies();
  }

  loadProxies(): void {
    this.isLoading = true;
    // Seçili sekmeye (status) göre istek atıyoruz
    this.proxyService
      .getProxies(this.activeTab())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.proxies = data;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notification.error('Vekil kayıtları yüklenirken bir hata oluştu.');
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  updateStatus(proxy: GuardianProxy, status: ProxyApprovalStatus): void {
    this.proxyService
      .approveProxy(proxy.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.sonuc === 1) {
            this.notification.success(res.sunucuCevap || 'İşlem başarılı.');
            this.loadProxies();
          } else {
            this.notification.error(res.sunucuCevap || 'İşlem başarısız.');
          }
        },
        error: () => this.notification.error('Sunucu hatası oluştu.'),
      });
  }

  getSeverity(
    status: ProxyApprovalStatus,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case ProxyApprovalStatus.Approved:
        return 'success';
      case ProxyApprovalStatus.Rejected:
        return 'danger';
      case ProxyApprovalStatus.Pending:
        return 'warn';
      default:
        return 'info';
    }
  }
}
