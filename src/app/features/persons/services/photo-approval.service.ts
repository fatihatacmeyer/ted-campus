import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { unwrapResponse } from '../../../shared/utils/response.utils';

// SP'den dönen kolonların birebir karşılığı
export interface PhotoApproval {
  Id: number;
  SicilId: number | null;
  SicilAdSoyad: string | null;
  VekilCampusId: number | null;
  VekilAdSoyad: string | null;
  DosyaAdi: string;
  YuklemeTarihi: string;
  IsActive: boolean;
  OnayDurumu: number;
  OnayDurumuMetni: string;
}

@Injectable({
  providedIn: 'root',
})
export class PhotoApprovalService {
  private api = inject(ApiHelperService);

  // Sadece OnayDurumu = 0 (Bekliyor) olanları çeker
  getPendingPhotos(): Observable<PhotoApproval[]> {
    return this.api
      .callEndpoint<PhotoApproval[]>('Dynamic', {
        point: 'ProfilFotografCampus',
        islemtipi: 's',
        OnayDurumu: 0,
      })
      .pipe(map((rows) => rows || []));
  }

  // Fotoğrafı onayla (1) veya reddet (-1)
  updatePhotoStatus(
    profilFotografId: number,
    onayDurumu: number,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<any[]>('Dynamic', {
        point: 'ProfilFotografTalep',
        islemtipi: 'o',
        ProfilFotografId: profilFotografId,
        OnayDurumu: onayDurumu,
      })
      .pipe(
        map((response) => {
          const unwrapped = unwrapResponse(response);
          return {
            sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
            sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
          };
        }),
      );
  }
}
