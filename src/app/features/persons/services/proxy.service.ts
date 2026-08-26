import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { unwrapResponse } from '../../../shared/utils/response.utils';
import { GuardianProxy, ProxyApprovalStatus } from '../../../core/models/proxy.model';

interface DBInsertResult {
  Sonuc: number | string;
  SunucuCevap: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProxyService {
  private api = inject(ApiHelperService);

  getProxies(onayDurumu?: ProxyApprovalStatus | null): Observable<GuardianProxy[]> {
    const params: Record<string, string | number> = {
      point: 'VekilCampus',
      islemtipi: 's',
    };

    // Eğer null veya undefined değilse (0, 1, -1 ise) parametreye ekle.
    // Null ise hiç gönderme, SQL Server'da NULL varsayılan değeri çalışsın.
    if (onayDurumu !== null && onayDurumu !== undefined) {
      params['OnayDurumu'] = onayDurumu;
    }

    return this.api.callEndpoint<any[]>('Dynamic', params).pipe(
      map((rows) =>
        (rows || []).map((row) => ({
          id: row.Id,
          veliSicilId: row.VeliSicilId,
          veliAdSoyad: row.VeliAdSoyad,
          ogrenciSicilId: row.OgrenciSicilId,
          ogrenciAdSoyad: row.OgrenciAdSoyad,
          vekilAdSoyad: row.VekilAdSoyad,
          vekilTelefon: row.VekilTelefon,
          vekilTC: row.VekilTC,
          yakinlik: row.Yakinlik,
          basTarih: row.BasTarih,
          bitTarih: row.BitTarih,
          isActive: row.IsActive,
          onayDurumu: row.OnayDurumu,
          onayDurumuMetni: row.OnayDurumuMetni,
          createdDate: row.CreatedDate,
        })),
      ),
    );
  }

  approveProxy(
    vekilCampusId: number,
    onayDurumu: ProxyApprovalStatus,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'VekilTalep',
        islemtipi: 'o',
        VekilCampusId: vekilCampusId,
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

  /**
   * Onaylanmış vekillerin aktif/pasif durumunu değiştirir.
   * sp_VekilTalep_ap procedure'ünü çağırır — hem VekilCampus hem LoginMeCampus tablosunu günceller.
   */
  toggleProxyActive(
    vekilCampusId: number,
    onayDurumu: 0 | 1,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'VekilTalep',
        islemtipi: 'ap',
        VekilCampusId: vekilCampusId,
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
