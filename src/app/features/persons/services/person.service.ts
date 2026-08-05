import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, map, tap } from 'rxjs';
import { APP_CONFIG, AppConfig } from '../../../core/services/app-config.service';
import {
  Person,
  PersonInsertRequest,
  PersonLeaveRequest,
  PersonLeaveAssignParams,
  PersonLeaveAssignCampusParams,
  OperationResultResponse,
  ExitReason,
  UserDef,
  getUserDefLabel,
  LeaveRequestResponse,
  ReportLinkResponse,
  RelationCampusRow,
} from '../../../core/models/person.model';
import { AuthService } from '../../../core/services/auth.service';
import { PrepareService } from '../../../core/services/prepare.service';
import { ApiHelperService } from '../../../core/services/api-helper.service';

/**
 * sp_sicilcampus_s'ten dönen ham DB satırı (Türkçe/DB sütun adları).
 *
 * Backend'deki generic "Dynamic" dispatcher, point + islemtipi kombinasyonuna
 * göre ilgili prosedürü çağırıyor:
 *   point=SicilCampus & islemtipi=s -> sp_sicilcampus_s (liste)
 *
 * Prosedür Sicil tablosunun tüm kolonlarına ek olarak:
 *   - UserType     (sys_userdef.ad tip kodu — "OGRENCI"/"VELI"/"OGRETMEN",
 *                   UserDef kolonu DÖNMEZ; frontend tipi bu metinden türetir)
 *   - VeliSicilId  (RelationCampus üzerinden ilk velinin sicil id, TOP(1);
 *                   backend JSON'da bazen string döndürebilir)
 *   - VeliAdSoyad  (ilk velinin "Ad Soyad" metni)
 * döndürür. @userdef boş bırakılırsa tüm tipler döner (backend'de
 * `WHERE (UserDef = @userdef OR @userdef IS NULL)` düzeltmesi uygulanmıştır).
 *
 * Kolon adları DB'den geldiği gibi (PascalCase/Türkçe) tutulur; Person
 * modeline çevrim mapSicilCampusRow içinde yapılır.
 */
interface SicilCampusRow {
  ID: number;
  Ad: string;
  Soyad: string;
  AdSoyad?: string;
  SicilNo: string;
  PersonelNo: string;
  UserID?: string;
  Firma?: string;
  FirmaAd?: string;
  Bolum?: string;
  BolumAd?: string;
  Pozisyon?: string;
  PozisyonAd?: string;
  AltFirma?: string;
  AltFirmaAd: string;
  Direktorluk?: string;
  DirektorlukAd?: string;
  Gorev?: string;
  GorevAd?: string;
  Yaka?: string;
  YakaAd?: string;
  CardId?: string;
  UserDef?: number;
  UserDefAd?: string;
  CikisTarih?: string | null;
  indirimorani?: number;
  CepTelefon?: string;
  MesaiPeriyodu?: number;
  MesaiPeriyoduAd?: string;
  credit?: number;
  Lyetki?: number;
  Lkademe?: number;
  YetkiStr?: string;
  YetkiStrAd?: string;
  DogumTarih?: string | null;
  Cinsiyet?: string | null;
  KanGrubu?: string | null;
  Telefon1?: string | null;
  EMail?: string | null;
  Adres?: string | null;
  IL?: string | null;
  Ilce?: string | null;
  GirisTarih?: string | null;
  OKod1?: string;
  // sp_sicilcampus_s ek kolonları
  UserType?: string;
  VeliSicilId?: number | string;
  VeliAdSoyad?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PersonService {
  private http = inject(HttpClient);
  private config: AppConfig = inject(APP_CONFIG);
  private authService = inject(AuthService);
  private prepareService = inject(PrepareService);
  private api = inject(ApiHelperService);

  /**
   * insertPerson ve updatePerson arasındaki ortak payload yapısını oluşturur.
   * Farklılık sadece islemtipi ('i'|'u') ve id (0|gerçek id) parametreleridir.
   *
   * okod17-okod20 için "undefined" string'i legacy sistemde de aynen
   * gönderiliyor (muhtemelen eski koddaki bir kusur) — backend bunu kabul
   * ettiği için biz de birebir koruyoruz.
   */
  private buildPersonPayload(
    personData: PersonInsertRequest,
    islemtipi: 'i' | 'u',
    id: number,
  ): { Param: string; FotoImage: string } {
    const paramString = this.api.buildParamString({
      islemtipi,
      id,
      ad: personData.ad || '',
      soyad: personData.soyad || '',
      sicilno: personData.sicilno || '',
      personelno: personData.personelno || '',
      firma: personData.firma || '',
      bolum: personData.bolum || '',
      pozisyon: personData.pozisyon || '',
      gorev: personData.gorev || '',
      altfirma: personData.altfirma || '',
      yaka: personData.yaka || '',
      direktorluk: personData.direktorluk || '',
      kangrubu: personData.kangrubu || '',
      cinsiyet: personData.cinsiyet || '',
      maastipi: '',
      adres: personData.adres || ' ',
      il: personData.il || '',
      ilce: personData.ilce || '',
      email: personData.email || '',
      dogumtarih: personData.dogumtarih || '',
      giristarih: personData.giristarih || '',
      telefon1: personData.telefon1 || '',
      ceptelefon: personData.ceptelefon || '',
      okod1: personData.okod1 || '',
      okod2: '',
      okod3: '',
      okod4: '',
      okod5: '',
      okod6: '',
      okod7: '',
      okod8: '',
      okod9: '',
      okod10: '',
      okod11: '',
      okod12: '',
      okod13: '',
      okod14: '',
      okod15: '',
      okod16: '',
      okod17: 'undefined',
      okod18: 'undefined',
      okod19: 'undefined',
      okod20: 'undefined',
      cardid: personData.cardid || '',
      cardid26: '',
      facilitycode: '',
      master: '',
      bypasscard: '',
      puantaj: '',
      userdef: personData.userdef,
      fazlamesai: 0,
      eksikmesai: 0,
      erkenmesai: 0,
      eksikgun: 0,
      gecezammi: 0,
      eksikfm: 0,
      eksikfmas: 0,
    });

    const encryptedParam = this.prepareService.prepare(paramString);

    return {
      Param: encryptedParam,
      FotoImage: personData.fotoImage
        ? JSON.stringify([{ fotoimage: personData.fotoImage }])
        : JSON.stringify([{ fotoimage: null }]),
    };
  }

  getPersonList(): Observable<Person[]> {
    const paramString = this.api.buildParamString({
      islemtipi: 'sv2',
      id: '',
      ad: '',
      soyad: '',
      sicilno: '',
      personelno: '',
      firma: '',
      bolum: '',
      pozisyon: '',
      gorev: '',
      altfirma: '',
      yaka: '',
      direktorluk: '',
      sicilgroup: '',
      cardid: '',
      userdef: '',
      aktif: 1, // sadece aktif siciller, 0 yaparsan pasiflerle beraber tüm liste gelir
      okod1: '',
      okod2: '',
      okod3: '',
      okod4: '',
      okod5: '',
      okod6: '',
      okod7: '',
      yetki: -1,
    });

    return this.api.postParam<Person[]>('PersonList', paramString);
  }

  /**
   * sp_sicilcampus_s üzerinden tüm sicil tiplerini (öğrenci/veli/öğretmen)
   * tek çağrıda çeker. @userdef boş gider -> backend `UserDef = @userdef OR
   * @userdef IS NULL` sayesinde tüm kayıtları döndürür (client-side
   * filtreleme ve allPersons mantığı sv2 ile aynı şekilde çalışır).
   *
   * Dynamic dispatcher deseni: point=SicilCampus & islemtipi=s.
   * NOT: islemno Dynamic deseninde parametre olarak gönderilmez — AES
   * oturum anahtarının SC bileşeni olarak PrepareService içinde kullanılır.
   */
  getPersonListCampus(): Observable<Person[]> {
    return this.api
      .callEndpoint<SicilCampusRow[]>('Dynamic', {
        point: 'sicilcampus',
        islemtipi: 's',
      })
      .pipe(map((rows) => (rows || []).map((row) => this.mapSicilCampusRow(row))));
  }

  /**
   * sp_sicilcampus_s UserDef kolonu DÖNDÜRMÜYOR; sicil tipi UserType
   * metninden ("OGRENCI"/"VELI"/"OGRETMEN") türetilir. Prosedür ileride
   * UserDef da döndürürse öncelik ona verilir.
   * Bilinmeyen/boş UserType -> 0 döner (hiçbir listeye takılmaz).
   */
  private resolveUserDef(row: SicilCampusRow): number {
    if (row.UserDef != null) return row.UserDef;
    const type = (row.UserType || '').toUpperCase();
    if (type.includes('OGRENCI') || type.includes('ÖĞRENCİ')) return UserDef.Ogrenci;
    if (type.includes('VELI') || type.includes('VELİ')) return UserDef.Veli;
    if (type.includes('OGRETMEN') || type.includes('ÖĞRETMEN')) return UserDef.Ogretmen;
    return 0;
  }

  /**
   * sp_sicilcampus_s ham DB satırını Person modeline çevirir.
   * AdSoyad DB'de yoksa Ad + Soyad birleştirilerek üretilir; islemsonuc
   * sv2 yanıtıyla aynı sözleşmeyi taşımadığı için 0 varsayılır.
   */
  private mapSicilCampusRow(row: SicilCampusRow): Person {
    const userdef = this.resolveUserDef(row);
    const veliSicilId =
      row.VeliSicilId != null && row.VeliSicilId !== '' ? Number(row.VeliSicilId) : undefined;
    return {
      id: row.ID,
      ad: row.Ad,
      soyad: row.Soyad,
      adsoyad: row.AdSoyad || [row.Ad, row.Soyad].filter(Boolean).join(' ') || '',
      sicilno: row.SicilNo,
      personelno: row.PersonelNo,
      userid: row.UserID || '',
      firma: row.Firma || '',
      firmaad: row.FirmaAd || '',
      bolum: row.Bolum || '',
      bolumad: row.BolumAd || '',
      pozisyon: row.Pozisyon || '',
      pozisyonad: row.PozisyonAd || '',
      altfirma: row.AltFirma || '',
      altfirmaad: row.AltFirmaAd || '',
      direktorluk: row.Direktorluk || '',
      direktorlukad: row.DirektorlukAd || '',
      gorev: row.Gorev || '',
      gorevad: row.GorevAd || '',
      yaka: row.Yaka || '',
      yakaad: row.YakaAd || '',
      credit: row.credit ?? 0,
      indirimorani: row.indirimorani ?? 0,
      ceptelefon: row.CepTelefon || '',
      mesaiperiyodu: row.MesaiPeriyodu ?? 0,
      mesaiperiyoduad: row.MesaiPeriyoduAd || '',
      cikistarih: row.CikisTarih ?? null,
      lyetki: row.Lyetki ?? 0,
      lkademe: row.Lkademe ?? 0,
      userdef: userdef,
      userdefad: row.UserDefAd || getUserDefLabel(userdef),
      cardid: row.CardId || '',
      yetkistr: row.YetkiStr || '',
      yetkistrad: row.YetkiStrAd || '',
      islemno: '',
      islemsonuc: 0,
      sunucucevap: null,
      dogumtarih: row.DogumTarih ?? null,
      cinsiyet: row.Cinsiyet ?? null,
      kangrubu: row.KanGrubu ?? null,
      telefon1: row.Telefon1 ?? null,
      email: row.EMail ?? null,
      adres: row.Adres ?? null,
      il: row.IL ?? null,
      ilce: row.Ilce ?? null,
      giristarih: row.GirisTarih ?? null,
      okod1: row.OKod1 || '',
      // sp_sicilcampus_s ek kolonları
      userType: row.UserType,
      veliSicilId: veliSicilId,
      veliAdSoyad: row.VeliAdSoyad,
    };
  }

  /**
   * insertPerson ve updatePerson için ortak ön-koşul: userdef zorunludur.
   */
  private assertUserDef(personData: PersonInsertRequest | null | undefined): void {
    if (!personData || personData.userdef == null) {
      throw new Error(
        `userdef zorunludur (${UserDef.Ogrenci}: Öğrenci, ${UserDef.Ogretmen}: Öğretmen, ${UserDef.Veli}: Veli).`,
      );
    }
  }

  /**
   * Yeni sicil (öğrenci / öğretmen / veli) ekler.
   * Hangi component'ten çağrıldığı fark etmez; ayrımı `personData.userdef` yapar.
   */
  insertPerson(personData: PersonInsertRequest): Observable<Person[]> {
    this.assertUserDef(personData);

    const payload = this.buildPersonPayload(personData, 'i', 0);
    return this.http.post<Person[]>(`${this.config.apiUrl}/Person`, payload);
  }

  /**
   * Mevcut bir sicil kaydını günceller.
   * insertPerson ile aynı payload yapısını kullanır; fark olarak
   * `islemtipi: 'u'` ve gerçek `id` gönderilir.
   */
  updatePerson(personData: PersonInsertRequest & { id: number }): Observable<Person[]> {
    this.assertUserDef(personData);

    const payload = this.buildPersonPayload(personData, 'u', personData.id);
    return this.http.post<Person[]>(`${this.config.apiUrl}/Person`, payload);
  }

  /**
   * Güncelle + Onayla: AngelWeb'deki iki aşamalı update flow'unu takip eder.
   * 1. POST /Person (islemtipi: 'u') — veriyi kaydeder
   * 2. GET /Dynamic (point=SicilIslem, islemtipi=u) — kaydı aktifleştirir
   *
   * AngelWeb'de "Kaydet" butonuna basıldığında aynı iki istek atılıyor:
   *   POST /Person → ardından GET /Dynamic?Name=SCI!...
   * Dynamic olmadan veri geçici olarak kaydedilir ama aktifleşmez.
   */
  updateAndConfirm(personData: PersonInsertRequest & { id: number }): Observable<unknown> {
    return this.updatePerson(personData).pipe(
      switchMap(() => {
        const sicilno = personData.sicilno || '';
        return this.api.callEndpoint<unknown>('Dynamic', {
          point: 'SicilIslem',
          islemtipi: 'u',
          Deger: sicilno,
        });
      }),
    );
  }

  terminatePerson(sicilIds: number[], nedenId: number, cikisTarihi: string): Observable<unknown> {
    const sicilIdString = sicilIds.join('#');

    return this.api.callEndpoint<unknown>('Dynamic', {
      islemtipi: 'c',
      point: 'sicil',
      sicilid: sicilIdString,
      neden: nedenId,
      cikistarih: cikisTarihi,
      type: 'cikis',
    });
  }

  requestLeave(leaveRequest: PersonLeaveRequest): Observable<LeaveRequestResponse[]> {
    // Legacy JS'te boş değişkenler string concatenation sırasında "undefined" string'ine dönüşür.
    // Backend bu formatta parse ettiği için aynı davranışı koruyoruz.
    const params = {
      point: 'talep',
      kaynak: 'izin',
      bastarih: leaveRequest.bastarih,
      bittarih: leaveRequest.bittarih,
      siciller: leaveRequest.siciller,
      tip: 30,
      islemtipi: 'i',
      izinadresi: leaveRequest.izinadresi || 'undefined',
      ulasim: leaveRequest.ulasim,
      yemek: leaveRequest.yemek,
      aciklama: leaveRequest.aciklama || 'undefined',
    };

    return this.api.callEndpoint<LeaveRequestResponse[]>('Dynamic', params);
  }

  /**
   * İzin formu PDF'ini getirir.
   * Legacy: formgosternew(formid, 'izin') → GET /report?Name={encrypted}
   * Params: islemtipi=s&reportid=IZINFORM&params=id:{formid}&islemno=1
   */
  /**
   * Direkt izin atama — sp_pdks_ik prosedürüne gider.
   * Legacy: izinkaydet2() → POST /TA → sp_pdks_ik
   *
   * Legacy param formatı (birebir):
   *   islemtipi=ik&extra= [JSON]&tip=...&saatbas=...&saatbit=...&ucretli=...&saatlik=...&aciklama=...&sicilid=0&tarih=undefined&tarihbit=undefined
   *
   * Response: [{ islemsonuc: "1"|"2", sunucucevap: string }]
   *   "1" = başarılı, "2" = başarısız
   */
  assignLeave(params: PersonLeaveAssignParams): Observable<OperationResultResponse[]> {
    // Legacy uyumu: "extra= " (boşluk) + JSON — buildParamString ile yapılamaz,
    // manuel concatenation ile birebir aynı string oluşturulur.
    const paramString =
      `islemtipi=${params.islemtipi}` +
      `&extra= ${params.extra}` +
      `&tip=${params.tip}` +
      `&saatbas=${params.saatbas}` +
      `&saatbit=${params.saatbit}` +
      `&ucretli=${params.ucretli}` +
      `&saatlik=${params.saatlik}` +
      `&aciklama=${params.aciklama}` +
      `&sicilid=${params.sicilid}` +
      `&tarih=${params.tarih}` +
      `&tarihbit=${params.tarihbit}`;

    const user = this.authService.currentUserValue;
    console.log(paramString);

    return this.api
      .postParam<OperationResultResponse[] | OperationResultResponse>('TA', paramString, {
        tokenid: user?.tokenid || '',
      })
      .pipe(
        map((raw) => {
          if (Array.isArray(raw)) return raw;
          if (raw && typeof raw === 'object') return [raw];
          console.error('[assignLeave] Beklenmeyen response:', raw);
          return [];
        }),
      );
  }

  assignLeaveCampus(params: PersonLeaveAssignCampusParams): Observable<unknown> {
    return this.api.callEndpoint<unknown>('Dynamic', {
      point: 'izinatacampus',
      islemtipi: 'i',
      sicilid: params.sicilid,
      tip: params.tip,
      bastarih: params.bastarih,
      bittarih: params.bittarih,
      saatlikmi: params.saatlikmi,
      aciklama: params.aciklama,
      blok: params.blok,
    });
  }

  getLeaveReport(formid: string): Observable<ReportLinkResponse[]> {
    return this.api.callEndpoint<ReportLinkResponse[]>('report', {
      islemtipi: 's',
      reportid: 'IZINFORM',
      params: `id:${formid}`,
      islemno: 1,
    });
  }

  restorePerson(sicilId: number, girisTarihi: string): Observable<unknown> {
    return this.api.callEndpoint<unknown>('Dynamic', {
      islemtipi: 'c',
      point: 'sicil',
      sicilid: sicilId,
      neden: 0,
      cikistarih: girisTarihi,
      type: 'donus',
    });
  }

  getExitReasons(): Observable<ExitReason[]> {
    return this.api
      .callEndpoint<unknown>('Dynamic', {
        kaynak: 'access',
        point: 'gridcbo',
        islemtipi: 's',
        id: 0,
      })
      .pipe(map((data) => (Array.isArray(data) ? data : []) as ExitReason[]));
  }

  // --- VELİ - ÖĞRENCİ İLİŞKİSİ (RelationCampus) ---

  /**
   * Öğrencinin tüm velilerini getirir (sp_relationcampus_s, tip=2).
   * Her satır: { VeliSicilId, relid } — relid (Id'nin SQL alias'ı), ilişkiyi güncellemek/silmek için zorunludur.
   *
   * NOT: Prosedürde parametre varsayılanı yok; dispatcher yalnızca gönderilen
   * parametreleri iletiyor. Bu yüzden kullanılmayanlar boş string ('') gönderilir
   * (int'e 0 olarak dönüşür) — aksi halde "expects parameter" hatası döner.
   */
  getStudentRelation(ogrenciSicilId: number): Observable<RelationCampusRow[]> {
    return this.api
      .callEndpoint<RelationCampusRow[]>('Dynamic', {
        point: 'relationcampus',
        islemtipi: 's',
        //islemno: '',
        tip: 2,
        vsicilid: '',
        osicilid: ogrenciSicilId,
      })
      .pipe(
        tap((rows) =>
          console.log('[Rel] getStudentRelation ham yanıt (tip=2):', JSON.stringify(rows)),
        ),
      );
  }

  /**
   * Velinin tüm öğrencilerini getirir (sp_relationcampus_s, tip=1).
   * Her satır: { OgrenciSicilId, relid } (Id'nin SQL alias'ı).
   * Kullanılmayan parametreler boş string gönderilir (bkz. getStudentRelation notu).
   */
  getParentRelations(veliSicilId: number): Observable<RelationCampusRow[]> {
    return this.api
      .callEndpoint<RelationCampusRow[]>('Dynamic', {
        point: 'relationcampus',
        islemtipi: 's',
        //islemno: '',
        tip: 1,
        vsicilid: veliSicilId,
        osicilid: '',
      })
      .pipe(
        tap((rows) =>
          console.log('[Rel] getParentRelations ham yanıt (tip=1):', JSON.stringify(rows)),
        ),
      );
  }

  /**
   * TÜM veli-öğrenci ilişkilerini tek çağrıda getirir (sp_relationcampus_s, tip=0).
   * Veli listesi sayfasında "Çocuklar" kolonunu beslemek için kullanılır —
   * satır başına N+1 çağrı yapmak yerine tek istek + client-side map kurulur.
   * Kullanılmayan parametreler boş string gönderilir (bkz. getStudentRelation notu).
   */
  getAllRelations(): Observable<RelationCampusRow[]> {
    return this.api
      .callEndpoint<RelationCampusRow[]>('Dynamic', {
        point: 'relationcampus',
        islemtipi: 's',
        //islemno: '',
        tip: 0,
        vsicilid: '',
        osicilid: '',
      })
      .pipe(
        tap((rows) =>
          console.log('[Rel] getAllRelations ham yanıt (tip=0):', JSON.stringify(rows)),
        ),
      );
  }

  addRelationCampus(ogrenciSicilId: number, veliSicilId: number): Observable<unknown> {
    return this.api.callEndpoint('Dynamic', {
      point: 'velicampus',
      islemtipi: 'i',
      ogrencisicilid: ogrenciSicilId,
      velisicilid: veliSicilId,
    });
  }

  updateRelationCampus(
    ogrenciSicilId: number,
    veliSicilId: number,
    relId: number,
  ): Observable<unknown> {
    return this.api.callEndpoint('Dynamic', {
      point: 'velicampus',
      islemtipi: 'u',
      ogrencisicilid: ogrenciSicilId,
      velisicilid: veliSicilId,
      relid: relId,
    });
  }

  deleteRelationCampus(relId: number): Observable<unknown> {
    return this.api.callEndpoint('Dynamic', {
      point: 'velicampus',
      islemtipi: 'd',
      relid: relId,
    });
  }
}
