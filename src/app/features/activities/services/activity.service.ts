import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ActivityInterface } from '../../../core/models/activity.model';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatDate } from '../../../shared/utils/date.utils';

/**
 * Backend'deki generic "Dynamic" dispatcher, point + islemtipi kombinasyonuna
 * göre ilgili prosedürü çağırıyor:
 *   point=EtkinlikCampus & islemtipi=s -> sp_etkinlikcampus_s (liste)
 *   point=EtkinlikCampus & islemtipi=i -> sp_etkinlikcampus_i (ekle)
 *   point=EtkinlikCampus & islemtipi=u -> sp_etkinlikcampus_u (güncelle)
 *   point=EtkinlikCampus & islemtipi=d -> sp_etkinlikcampus_d (sil)
 *
 * NOT (izintipleridoldur ile birebir aynı desen):
 * param string'i asla encode edilmiyor, tek parça halinde AES ile
 * şifrelenip "Name" query parametresi olarak GET isteğiyle gönderiliyor.
 *
 * Dispatcher, point + islemtipi kombinasyonunu otomatik çözer ve ilgili
 * prosedürü çağırır (sp_etkinlikcampus_{s,i,u,d}). 3.08.2026'da 'i' rutini
 * backend'de hazır değilken aynı istek `islemsonuc:3, sunucucevap:"sub"`
 * döndü; prosedür kaydedildikten sonra insert çalıştı. islemno göndermek
 * bu zarfta hiçbir şeyi değiştirmiyordu (test edildi).
 */
/** sp_etkinlikcampus_s'den dönen ham DB satırı (Türkçe/DB sütun adları). */
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
  UlasimTipi: string;
  SorumluAdSoyad: string;
  EgitimDuzeyi?: string;
  Okod1: string;
  Okod2: string;
  Okod3: string;
  Okod4: string;
  okod5: string;
  Duzenleyen: number;
  CreatedDate: Date | string;
  Sinif: string;
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

  /**
   * sp_etkinlikcampus_s sonuç sütunlarını (Türkçe/DB isimleri) ActivityInterface'e çevirir.
   * DİKKAT: Bu SP TurId/UlasimId/SinifId/EgitimDuzeyiId yerine metin karşılıklarını
   * (Tur, UlasimTipi, Sinif, EgitimDuzeyi) döndürüyor -- çünkü join'li bir "görüntüleme"
   * sorgusu. Ekle/güncelle tarafında ise SP'ler gerçek Id (int) bekliyor. Bu yüzden
   * satırda "...Id" alanlarını da (varsa) ayrıca saklıyoruz; aksi halde bir kaydı
   * tekrar kaydederken hangi TurId/UlasimId/SinifId seçili olduğunu bilemeyiz.
   * Bu ekstra id alanları backend'de _s prosedürüne eklenene kadar burada undefined kalacaktır.
   */
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
      transportation: row.UlasimTipi,
      eventManager: row.SorumluAdSoyad,
      educationLevel: row.EgitimDuzeyi,
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

  /**
   * addActivity/updateActivity ortak payload'ı. Key sırası sabittir (islemtipi,
   * güncellemede Id, sonra Ad, XSicilId, ...) — sıra değiştirilirse AES şifreli
   * wire string değişir; sıraya dokunulmaz.
   */
  private buildActivityParams(
    activity: Partial<ActivityInterface> & Record<string, unknown>,
    islemtipi: 'i' | 'u',
    id?: number,
  ): Record<string, string | number> {
    return {
      islemtipi,
      ...(id !== undefined ? { Id: id } : {}),
      Ad: (activity.name as string) || '',
      XSicilId:
        (activity.xSicilID as number) ??
        this.authService.currentUserValue?.xsicilid ??
        233,
      BasTarih: formatDate(activity.startDate as string),
      BitTarih: formatDate(activity.endDate as string),
      TurId: (activity['turId'] as number) ?? '',
      UcretliMi: activity.isPaid ? 1 : 0,
      Ucret: (activity.fee as number) ?? '',
      // Backend Durum'u '1'/'0' olarak saklıyor (sp_etkinlikcampus_s "1"/"0" döner).
      // Form metin tutuyor ('Aktif'/'Pasif'/'İptal'), edit'te ise satırdan '1'/'0' gelir.
      // → 'Aktif' veya '1' → '1', diğerleri ('Pasif'/'İptal'/'0') → '0'.
      Durum: ['Aktif', '1'].includes(String(activity.status)) ? '1' : '0',
      TalepBas: formatDate(activity.requestStartDate as string),
      TalepBit: formatDate(activity.requestEndDate as string),
      VeliZorunluMu: activity.isParentRequired ? 1 : 0,
      Aciklama: (activity.description as string) || '',
      MaksOgrenciSayisi: (activity.maxStudentCount as number) ?? '',
      MaksVeliSayisi: (activity.studentParentCount as number) ?? '',
      // SorumluSicilId formda henüz seçilmiyor; şimdilik giriş yapmış kullanıcının
      // sicil id'si default gider (şu anki kullanıcı 233). İleride formdan sorumlu
      // seçimi eklenince gerçek değer buraya düşecek.
      SorumluSicilId:
        (activity['sorumluSicilId'] as number) ??
        this.authService.currentUserValue?.xsicilid ??
        233,
      UlasimId: (activity['ulasimId'] as number) ?? '',
      YasSiniri: (activity['yasSiniri'] as string) || '',
      EgitimDuzeyiId: (activity['egitimDuzeyiId'] as number) ?? '',
      SinifId: (activity['sinifId'] as number) ?? '',
      Okod1: activity.oKod1 || '',
      Okod2: activity.oKod2 || '',
      Okod3: activity.oKod3 || '',
      Okod4: activity.oKod4 || '',
      Okod5: activity.oKod5 || '',
    };
  }

  /**
   * @param activity Formdan gelen değerler. TurId/UlasimId/SinifId/EgitimDuzeyiId
   * artık formdaki seçimlerden (ad → lookup id) doldurulup payload'a ekleniyor
   * (activities-list.ts saveActivity). SorumluSicilId formda hâlâ yok — şimdilik
   * giriş yapmış kullanıcının sicil id'si (233) default gönderiliyor.
   * XSicilId (etkinliği oluşturan): form hiç toplamıyor, giriş yapmış
   * kullanıcının kendi sicil id'sinden otomatik dolduruluyor.
   *
   * NOT: sp_etkinlikcampus_s FK'lara INNER JOIN yaptığı için, NULL kalan bir
   * satır INSERT olsa da listede görünmeyebilir — bu ayrı bir konu, insert'in
   * kendisini etkilemez.
   */
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
