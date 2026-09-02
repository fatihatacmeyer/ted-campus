import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
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

@Component({
  selector: 'app-photo-approval',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, ProgressSpinnerModule, TranslatePipe],
  templateUrl: './photo-approval.html',
  styleUrl: './photo-approval.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoApprovalComponent implements OnInit {
  private photoApprovalService = inject(PhotoApprovalService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private config: AppConfig = inject(APP_CONFIG);

  pendingPhotos: PhotoApproval[] = [];
  isLoading = false;
  processingId: number | null = null; // İşlem yapılan kartın loading state'i için

  failedPhotoIds = new Set<number>();

  onPhotoError(photoId: number): void {
    this.failedPhotoIds.add(photoId);
  }

  ngOnInit(): void {
    this.loadPendingPhotos();
  }

  loadPendingPhotos(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    // api çağrısı
    this.photoApprovalService
      .getPendingPhotos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.pendingPhotos = data;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notification.error('PHOTO_APPROVAL.ERROR_LOAD');
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  approvePhoto(photo: PhotoApproval): void {
    this.updateStatus(photo, 1);
  }

  rejectPhoto(photo: PhotoApproval): void {
    this.updateStatus(photo, -1);
  }

  private updateStatus(photo: PhotoApproval, status: number): void {
    this.processingId = photo.Id;
    this.cdr.markForCheck();

    this.photoApprovalService
      .updatePhotoStatus(photo.Id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.processingId = null;
          if (res.sonuc === 1) {
            this.notification.success(res.sunucuCevap || 'PHOTO_APPROVAL.SUCCESS');
            // Başarılı olanı listeden çıkarıyoruz (anında UI güncellenir)
            this.pendingPhotos = this.pendingPhotos.filter((p) => p.Id !== photo.Id);
          } else {
            this.notification.error(res.sunucuCevap || 'PHOTO_APPROVAL.FAILED');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.processingId = null;
          this.notification.error('PHOTO_APPROVAL.ERROR_SERVER');
          this.cdr.markForCheck();
        },
      });
  }

  // --- Yardımcı Metodlar (UI için) ---

  getPhotoUrl(fileName: string): string {
    const baseUrl = this.config.photoBaseUrl || 'http://localhost/MeCampus/ProfilFotograflari';
    const fullUrl = `${baseUrl}/${fileName}`;
    console.log('Resim Tam URL:', fullUrl);
    return `${baseUrl}/${fileName}`;
  }

  getPersonName(photo: PhotoApproval): string {
    return photo.SicilAdSoyad || photo.VekilAdSoyad || this.translate.instant('PHOTO_APPROVAL.UNKNOWN_PERSON');
  }

  getPersonType(photo: PhotoApproval): string {
    if (photo.SicilId) return 'PHOTO_APPROVAL.STAFF_OR_STUDENT';
    if (photo.VekilCampusId) return 'PHOTO_APPROVAL.PROXY';
    return 'PHOTO_APPROVAL.UNKNOWN';
  }

  getPersonTypeSeverity(
    photo: PhotoApproval,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    if (photo.SicilId) return 'info';
    if (photo.VekilCampusId) return 'warn';
    return 'secondary';
  }
}
