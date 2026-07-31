import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { APP_CONFIG, AppConfig } from './app-config.service';
import { ActivityInterface } from '../core/activity.model';
import { PrepareService } from './prepare.service';
import { AuthService } from './auth.service';

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
 * NOT: islemno artık gönderilmiyor. Farklı islemno/point kombinasyonlarıyla
 * yapılan testlerde backend her seferinde aynı jenerik hata zarfını
 * (islemsonuc:3, sunucucevap:"sub") döndürdü — bu da sorunun bizim
 * gönderdiğimiz alanlarda değil, /Dynamic dispatcher'ının "EtkinlikCampus"
 * point'ini tanıyıp tanımadığında olduğuna işaret ediyor. Backend log'u/
 * dispatcher kodu netleşince burası tekrar gözden geçirilebilir.
 */
@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private http = inject(HttpClient);
  private config: AppConfig = inject(APP_CONFIG);
  private prepareService = inject(PrepareService);
  private authService = inject(AuthService);

  private readonly point = 'etkinlikcampus';

  private buildParamString(params: Record<string, string | number>): string {
    return Object.entries(params)
      .map(([key, value]) => `${key}=${value ?? ''}`)
      .join('&');
  }

  private callDynamic<T>(params: Record<string, string | number>): Observable<T> {
    const paramString = this.buildParamString({
      point: this.point,
      ...params,
    });
    console.log(`[ActivityService] RAW param (${this.point}):`, paramString);
    const encryptedParam = this.prepareService.prepare(paramString);
    const apiUrl = `${this.config.apiUrl}/Dynamic?Name=${encodeURIComponent(encryptedParam)}`;
    return this.http.get<T>(apiUrl);
  }

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
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
  private mapRowToActivity(row: any): ActivityInterface {
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
    return this.callDynamic<any[]>({
      islemtipi: 's',
    }).pipe(map((rows) => (rows || []).map((row) => this.mapRowToActivity(row))));
  }

  /**
   * @param activity Formdan gelen değerler. TurId/UlasimId/SinifId/EgitimDuzeyiId/
   * SorumluSicilId gibi FK id alanları henüz formda toplanmıyor (lookup prosedürleri
   * hazır olana kadar) — hepsi SP'de "= NULL" default'lu olduğu için boş gönderiyoruz,
   * INSERT başarılı olur. Tek fark XSicilId (etkinliği oluşturan): form hiç toplamıyor,
   * bu yüzden giriş yapmış kullanıcının kendi sicil id'sinden otomatik dolduruyoruz.
   *
   * NOT: sp_etkinlikcampus_s bu FK'lara INNER JOIN yaptığı için, NULL kalan bir
   * satır INSERT olsa da listede görünmeyebilir — bu ayrı bir konu, insert'in
   * kendisini etkilemez.
   */
  addActivity(activity: Partial<ActivityInterface> & Record<string, unknown>): Observable<unknown> {
    const xSicilId =
      (activity.xSicilID as number) ?? this.authService.currentUserValue?.xsicilid ?? '';
    return this.callDynamic({
      islemtipi: 'i',
      Ad: (activity.name as string) || '',
      XSicilId: xSicilId,
      BasTarih: this.formatDate(activity.startDate as string),
      BitTarih: this.formatDate(activity.endDate as string),
      TurId: (activity['turId'] as number) ?? '',
      UcretliMi: activity.isPaid ? 1 : 0,
      Ucret: (activity.fee as number) ?? '',
      Durum: (activity.status as string) || '',
      TalepBas: this.formatDate(activity.requestStartDate as string),
      TalepBit: this.formatDate(activity.requestEndDate as string),
      VeliZorunluMu: activity.isParentRequired ? 1 : 0,
      Aciklama: (activity.description as string) || '',
      MaksOgrenciSayisi: (activity.maxStudentCount as number) ?? '',
      MaksVeliSayisi: (activity.studentParentCount as number) ?? '',
      SorumluSicilId: (activity['sorumluSicilId'] as number) ?? '',
      UlasimId: (activity['ulasimId'] as number) ?? '',
      YasSiniri: (activity['yasSiniri'] as string) || '',
      EgitimDuzeyiId: (activity['egitimDuzeyiId'] as number) ?? '',
      SinifId: (activity['sinifId'] as number) ?? '',
      Okod1: activity.oKod1 || '',
      Okod2: activity.oKod2 || '',
      Okod3: activity.oKod3 || '',
      Okod4: activity.oKod4 || '',
      Okod5: activity.oKod5 || '',
    });
  }

  updateActivity(
    id: number,
    activity: Partial<ActivityInterface> & Record<string, unknown>,
  ): Observable<unknown> {
    return this.callDynamic({
      islemtipi: 'u',
      Id: id,
      Ad: (activity.name as string) || '',
      XSicilId: (activity.xSicilID as number) ?? '',
      BasTarih: this.formatDate(activity.startDate as string),
      BitTarih: this.formatDate(activity.endDate as string),
      TurId: (activity['turId'] as number) ?? '',
      UcretliMi: activity.isPaid ? 1 : 0,
      Ucret: (activity.fee as number) ?? '',
      Durum: (activity.status as string) || '',
      TalepBas: this.formatDate(activity.requestStartDate as string),
      TalepBit: this.formatDate(activity.requestEndDate as string),
      VeliZorunluMu: activity.isParentRequired ? 1 : 0,
      Aciklama: (activity.description as string) || '',
      MaksOgrenciSayisi: (activity.maxStudentCount as number) ?? '',
      MaksVeliSayisi: (activity.studentParentCount as number) ?? '',
      SorumluSicilId: (activity['sorumluSicilId'] as number) ?? '',
      UlasimId: (activity['ulasimId'] as number) ?? '',
      YasSiniri: (activity['yasSiniri'] as string) || '',
      EgitimDuzeyiId: (activity['egitimDuzeyiId'] as number) ?? '',
      SinifId: (activity['sinifId'] as number) ?? '',
      Okod1: activity.oKod1 || '',
      Okod2: activity.oKod2 || '',
      Okod3: activity.oKod3 || '',
      Okod4: activity.oKod4 || '',
      Okod5: activity.oKod5 || '',
    });
  }

  deleteActivity(id: number): Observable<unknown> {
    return this.callDynamic({
      islemtipi: 'd',
      Id: id,
    });
  }
}
