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

    let pTypeStr: string;
    let pSeverity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

    // 1. Vekil Kontrolü: VekilCampusId doluysa öncelikli olarak Vekildir
    if (photo.VekilCampusId) {
      pTypeStr = 'PHOTO_APPROVAL.PROXY';
      pSeverity = 'warn'; // Turuncu Rozet
    }
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
