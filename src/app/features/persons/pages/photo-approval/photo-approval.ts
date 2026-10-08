import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PhotoApprovalService, PhotoApproval } from '../../services/photo-approval.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AppConfig, APP_CONFIG } from '../../../../core/services/app-config.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';

const MOCK_PHOTOS: PhotoApproval[] = [
  {
    Id: 101,
    SicilId: 1001,
    SicilAdSoyad: 'Ali Yılmaz',
    VekilCampusId: null,
    VekilAdSoyad: null,
    DosyaAdi: 'https://primefaces.org/cdn/primeng/images/avatar/amyelsner.png',
    YuklemeTarihi: '2026-09-30T09:00:00',
    IsActive: true,
    OnayDurumu: 0,
    OnayDurumuMetni: 'Bekliyor',
    UserDef: 11, // ÖĞRENCİ (Mavi Rozet bekleniyor)
  },
  {
    Id: 102,
    SicilId: 1002,
    SicilAdSoyad: 'Ayşe Kaya',
    VekilCampusId: null,
    VekilAdSoyad: null,
    DosyaAdi: 'hatali-resim-linki.jpg', // RESİM KIRIK TESTİ (Gri user ikonu bekleniyor)
    YuklemeTarihi: '2026-09-30T10:15:00',
    IsActive: true,
    OnayDurumu: 0,
    OnayDurumuMetni: 'Bekliyor',
    UserDef: 12, // VELİ (Yeşil Rozet bekleniyor)
  },
  {
    Id: 103,
    SicilId: 1003,
    SicilAdSoyad: 'Mehmet Demir',
    VekilCampusId: null,
    VekilAdSoyad: null,
    DosyaAdi: 'https://primefaces.org/cdn/primeng/images/avatar/asiyajavayant.png',
    YuklemeTarihi: '2026-09-29T14:20:00',
    IsActive: true,
    OnayDurumu: 0,
    OnayDurumuMetni: 'Bekliyor',
    UserDef: 13, // YETKİLİ (Siyah/Contrast Rozet bekleniyor)
  },
  {
    Id: 104,
    SicilId: 1004,
    SicilAdSoyad: 'Fatma Şahin',
    VekilCampusId: null,
    VekilAdSoyad: null,
    DosyaAdi: 'https://primefaces.org/cdn/primeng/images/avatar/onyamalimba.png',
    YuklemeTarihi: '2026-09-28T16:45:00',
    IsActive: true,
    OnayDurumu: 0,
    OnayDurumuMetni: 'Bekliyor',
    UserDef: 14, // ÖĞRETMEN (Kırmızı Rozet bekleniyor)
  },
  {
    Id: 105,
    SicilId: null,
    SicilAdSoyad: null,
    VekilCampusId: 5001,
    VekilAdSoyad: 'Hasan Öz (Vekil)',
    DosyaAdi: 'https://primefaces.org/cdn/primeng/images/avatar/ionibowcher.png',
    YuklemeTarihi: '2026-09-27T11:10:00',
    IsActive: true,
    OnayDurumu: 0,
    OnayDurumuMetni: 'Bekliyor',
    UserDef: 0, // VEKİL (Turuncu/Sarı Rozet bekleniyor - VekilCampusId dolu olduğu için UserDef önemsiz)
  },
  {
    Id: 106,
    SicilId: 1006,
    SicilAdSoyad: 'Bilinmeyen Personel',
    VekilCampusId: null,
    VekilAdSoyad: null,
    DosyaAdi: 'https://primefaces.org/cdn/primeng/images/avatar/xuxuefeng.png',
    YuklemeTarihi: '2026-09-26T08:30:00',
    IsActive: true,
    OnayDurumu: 0,
    OnayDurumuMetni: 'Bekliyor',
    UserDef: 99, // DİĞER/PERSONEL (Gri Rozet bekleniyor - Tanımsız ID)
  },
];

// UI için hesaplanmış alanları barındıran genişletilmiş arayüz
interface PhotoApprovalUI extends PhotoApproval {
  photoUrl: string;
  displayName: string;
  personTypeStr: string;
  personTypeSeverity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
}

@Component({
  selector: 'app-photo-approval',
  standalone: true,
  imports: [
    PageHeaderComponent,
    CommonModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './photo-approval.html',
  styleUrl: './photo-approval.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoApprovalComponent implements OnInit {
  private photoApprovalService = inject(PhotoApprovalService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private config: AppConfig = inject(APP_CONFIG);

  pendingPhotos = signal<PhotoApprovalUI[]>([]);
  isLoading = signal<boolean>(false);
  processingId = signal<number | null>(null);
  failedPhotoIds = signal<Set<number>>(new Set());

  ngOnInit(): void {
    this.loadPendingPhotos();
  }

  loadPendingPhotos(): void {
    this.isLoading.set(true);

    this.photoApprovalService
      .getPendingPhotos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          // Gerçek API'den gelen veriyi UI modeline dönüştürür
          const mappedData = data.map((photo) => this.mapToUI(photo));
          this.pendingPhotos.set(mappedData);
          this.isLoading.set(false);
        },
        error: () => {
          this.notification.error('PHOTO_APPROVAL.ERROR_LOAD');
          this.isLoading.set(false);
        },
      });
  }

  private updateStatus(photo: PhotoApprovalUI, status: number): void {
    this.processingId.set(photo.Id);

    this.photoApprovalService
      .updatePhotoStatus(photo.Id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.processingId.set(null);
          if (res.sonuc === 1) {
            this.notification.success(res.sunucuCevap || 'PHOTO_APPROVAL.SUCCESS');
            // Başarılı olanı listeden (UI'dan) anında temizler
            this.pendingPhotos.update((photos) => photos.filter((p) => p.Id !== photo.Id));
          } else {
            this.notification.error(res.sunucuCevap || 'PHOTO_APPROVAL.FAILED');
          }
        },
        error: () => {
          this.processingId.set(null);
          this.notification.error('PHOTO_APPROVAL.ERROR_SERVER');
        },
      });
  }

  /** Gelen DB objesini UI için formatlar ve hesaplanan özellikleri ekler */
  private mapToUI(photo: PhotoApproval): PhotoApprovalUI {
    const baseUrl = this.config.photoBaseUrl || 'http://localhost/MeCampus/ProfilFotograflari';

    let pTypeStr = 'PHOTO_APPROVAL.UNKNOWN';
    let pSeverity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' = 'secondary';

    // 1. Vekil Kontrolü: VekilCampusId doluysa öncelikli olarak Vekildir
    if (photo.VekilCampusId) {
      pTypeStr = 'PHOTO_APPROVAL.PROXY';
      pSeverity = 'warn'; // Turuncu Rozet
    }
    // 2. UserDef (ID) Kontrolü
    else {
      switch (photo.UserDef) {
        case 11:
          pTypeStr = 'USERDEF.STUDENT';
          pSeverity = 'info'; // Mavi Rozet
          break;
        case 12:
          pTypeStr = 'USERDEF.PARENT';
          pSeverity = 'success'; // Yeşil Rozet
          break;
        case 13:
          pTypeStr = 'USERDEF.AUTHORITY';
          pSeverity = 'contrast'; // Siyah Rozet (PrimeNG v17+)
          break;
        case 14:
          pTypeStr = 'USERDEF.TEACHER';
          pSeverity = 'danger'; // Kırmızı Rozet
          break;
        default:
          pTypeStr = 'PHOTO_APPROVAL.STAFF_OR_OTHER';
          pSeverity = 'secondary'; // Gri Rozet
          break;
      }
    }

    return {
      ...photo,
      photoUrl: `${baseUrl}/${photo.DosyaAdi}`,
      displayName:
        photo.SicilAdSoyad ||
        photo.VekilAdSoyad ||
        this.translate.instant('PHOTO_APPROVAL.UNKNOWN_PERSON'),
      personTypeStr: pTypeStr,
      personTypeSeverity: pSeverity,
    };
  }

  onPhotoError(photoId: number): void {
    this.failedPhotoIds.update((set) => {
      const newSet = new Set(set);
      newSet.add(photoId);
      return newSet;
    });
  }

  approvePhoto(photo: PhotoApprovalUI): void {
    this.updateStatus(photo, 1);
  }

  rejectPhoto(photo: PhotoApprovalUI): void {
    this.updateStatus(photo, -1);
  }
}
