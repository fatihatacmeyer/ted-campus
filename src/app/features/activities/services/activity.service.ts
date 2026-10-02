import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ActivityApprovalStats,
  ActivityInterface,
  ActivityParticipant,
} from '../../../core/models/activity.model';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatDate } from '../../../shared/utils/date.utils';

/** sp_etkinlikcampus_s'den dönen  DB satırı  */
interface ActivityRow {
  Id: number;
  EtkinlikAdi: string;
  EtkinlikBaslangic: Date | string;
  EtkinlikBitis: Date | string;
  Tur: string;
  UcretliMi: boolean | number;
  Ucret: number | null;
  Durum: string;
  TalepBas: Date | string;
  TalepBit: Date | string;
  VeliZorunluMu: boolean | number;
  Aciklama: string;
  MaksOgrenciSayisi: number;
  MaksVeliSayisi: number;
  VeliBasinaMisafirSayisi?: number;
  UlasimTipi: string;
  SorumluAdSoyad: string;
  EgitimDuzeyi?: string;
  CampusId?: number;
  CampusAdi?: string;
  SorumluSicilId?: number;
  YasSiniri?: string;
  SinifId?: string;
  Okod1: string;
  Okod2: string;
  Okod3: string;
  Okod4: string;
  okod5: string;
  Duzenleyen: number;
  CreatedDate: Date | string;
  Sinif: string;
}

/** sp_EtkinlikOnayCampus_s'ten dönen  DB satırı */
interface ActivityApprovalRow {
  EtkinlikId: number;
  Bekleyen: number;
  Onaylanan: number;
  Reddedilen: number;
  Toplam: number;
}

/** sp_EtkinlikKatilimcilari_s'ten dönen  DB satırı. */
interface ParticipantRow {
  SiraNo: number;
  OgrenciSicilId: number;
  Ogrenci: string;
  Sinif: string;
  VeliSicilId: number;
  Veli: string;
  Telefon: string;
  Durum: number;
  DurumMetni: string;
}

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private api = inject(ApiHelperService);
  private authService = inject(AuthService);

  private readonly point = 'etkinlikcampus';

  private callDynamic<T>(params: Record<string, string | number>): Observable<T> {
    const requestParams: Record<string, string | number> = { point: this.point, ...params };
    // Debug: giden isteğin şifrelenmemiş (okunabilir) hali — backend'e giden
    // gerçek wire string, ApiHelperService.callEndpoint içinde AES ile şifrelenir.
    console.log('[ActivityService] giden istek:', requestParams);
    return this.api.callEndpoint<T>('Dynamic', requestParams);
  }

  private mapRowToActivity(row: ActivityRow): ActivityInterface {
    return {
      id: row.Id,
      name: row.EtkinlikAdi,
      startDate: row.EtkinlikBaslangic,
      endDate: row.EtkinlikBitis,
      activityType: row.Tur,
      isPaid: !!row.UcretliMi,
      fee: row.Ucret,
      status: row.Durum,
      requestStartDate: row.TalepBas,
      requestEndDate: row.TalepBit,
      isParentRequired: !!row.VeliZorunluMu,
      description: row.Aciklama,
      maxStudentCount: row.MaksOgrenciSayisi,
      studentParentCount: row.MaksVeliSayisi,
      maxGuestPerParent: row.VeliBasinaMisafirSayisi,
      transportation: row.UlasimTipi,
      eventManager: row.SorumluAdSoyad,
      educationLevel: row.EgitimDuzeyi,
      campus: row.CampusAdi ?? '',
      campusId: row.CampusId,
      sorumluSicilId: row.SorumluSicilId,
      yasSiniri: row.YasSiniri ?? '',
      sinifId: row.SinifId ?? '',
      oKod1: row.Okod1,
      oKod2: row.Okod2,
      oKod3: row.Okod3,
      oKod4: row.Okod4,
      oKod5: row.okod5,
      xSicilID: row.Duzenleyen,
      createdAt: row.CreatedDate,
      isPrivate: !!row.Sinif && row.Sinif !== 'Tüm Sınıflar',
      classroom: row.Sinif,
    };
  }

  getActivities(): Observable<ActivityInterface[]> {
    return this.callDynamic<ActivityRow[]>({
      islemtipi: 's',
    }).pipe(map((rows) => (rows || []).map((row) => this.mapRowToActivity(row))));
  }

  getApprovalStats(etkinlikId: number): Observable<ActivityApprovalStats> {
    return this.callDynamic<ActivityApprovalRow[]>({
      point: 'etkinlikonaycampus',
      islemtipi: 's',
      EtkinlikId: etkinlikId,
    }).pipe(
      map((rows) => {
        const row = (rows || [])[0];
        return {
          etkinlikId: row?.EtkinlikId ?? etkinlikId,
          bekleyen: row?.Bekleyen ?? 0,
          onaylanan: row?.Onaylanan ?? 0,
          reddedilen: row?.Reddedilen ?? 0,
          toplam: row?.Toplam ?? 0,
        };
      }),
    );
  }

  getParticipants(etkinlikId: number): Observable<ActivityParticipant[]> {
    return this.callDynamic<ParticipantRow[]>({
      point: 'etkinlikkatilimcilari',
      islemtipi: 's',
      EtkinlikId: etkinlikId,
    }).pipe(
      map((rows) =>
        (rows || []).map((row) => ({
          id: row.SiraNo,
          ogrenciSicilId: row.OgrenciSicilId,
          ogrenci: row.Ogrenci,
          sinif: row.Sinif,
          veliSicilId: row.VeliSicilId,
          veli: row.Veli,
          telefon: row.Telefon ?? '',
          durum: (row.DurumMetni as ActivityParticipant['durum']) || 'Bekleyen',
        })),
      ),
    );
  }

  private buildActivityParams(
    activity: Partial<ActivityInterface> & Record<string, unknown>,
    islemtipi: 'i' | 'u',
    id?: number,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = {
      islemtipi,
      ...(id !== undefined ? { Id: id } : {}),
      Ad: (activity.name as string) || '',
      XSicilId: (activity.xSicilID as number) ?? this.authService.currentUserValue?.xsicilid ?? 233,
      BasTarih: formatDate(activity.startDate as string),
      BitTarih: formatDate(activity.endDate as string),
      TurId: (activity['turId'] as number) ?? '',
      UcretliMi: activity.isPaid ? 1 : 0,
      Ucret: (activity.fee as number) ?? 0,
      Durum: ['Aktif', '1'].includes(String(activity.status)) ? '1' : '0',
      TalepBas: formatDate(activity.requestStartDate as string),
      TalepBit: formatDate(activity.requestEndDate as string),
      VeliZorunluMu: activity.isParentRequired ? 1 : 0,
      Aciklama: (activity.description as string) || '',
      MaksOgrenciSayisi: (activity.maxStudentCount as number) ?? '',
      MaksVeliSayisi: (activity.studentParentCount as number) ?? '',
      SorumluSicilId: 0,
      SorumluAdSoyad: (activity.eventManager as string) || '',
      UlasimId: (activity['ulasimId'] as number) ?? '',
      YasSiniri: (activity['yasSiniri'] as string) || '',
      EgitimDuzeyiId: (activity['egitimDuzeyiId'] as number) ?? '',
      SinifId: activity.sinifId ?? '',
      VeliBasinaMisafirSayisi: (activity['maxGuestPerParent'] as number) ?? '',
      CampusId: (activity['campusId'] as number) ?? (activity['firmaId'] as number) ?? '',
      Okod1: activity.oKod1 || '',
      Okod2: activity.oKod2 || '',
      Okod3: activity.oKod3 || '',
      Okod4: activity.oKod4 || '',
      Okod5: activity.oKod5 || '',
    };

    for (const key of ['BasTarih', 'BitTarih', 'TalepBas', 'TalepBit'] as const) {
      if (!params[key]) {
        delete params[key];
      }
    }

    return params;
  }

  addActivity(activity: Partial<ActivityInterface> & Record<string, unknown>): Observable<unknown> {
    return this.callDynamic(this.buildActivityParams(activity, 'i'));
  }

  updateActivity(
    id: number,
    activity: Partial<ActivityInterface> & Record<string, unknown>,
  ): Observable<unknown> {
    return this.callDynamic(this.buildActivityParams(activity, 'u', id));
  }

  deleteActivity(id: number): Observable<unknown> {
    return this.callDynamic({
      islemtipi: 'd',
      Id: id,
    });
  }
}
