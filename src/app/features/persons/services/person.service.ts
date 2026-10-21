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
import { unwrapResponse } from '../../../shared/utils/response.utils';
import { LoginSendResult, parseLoginSendResponse, toSicilIdList } from '../utils/login-send.utils';

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
  CardID?: string;
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
  UserType?: string;
  VeliSicilId?: number | string;
  VeliAdSoyad?: string;
  GelisServisPlaka?: string;
  DonusServisPlaka?: string;
  OgrencilerSinif?: string | null;
  OgrenciKampusleri?: string | null;
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
      aktif: 1,
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

  getPersonListCampus(): Observable<Person[]> {
    return this.api
      .callEndpoint<SicilCampusRow[]>('Dynamic', {
        point: 'sicilcampus',
        islemtipi: 's',
      })
      .pipe(map((rows) => (rows || []).map((row) => this.mapSicilCampusRow(row))));
  }

  private resolveUserDef(row: SicilCampusRow): number {
    if (row.UserDef != null) return row.UserDef;
    const type = (row.UserType || '').toUpperCase();
    if (type.includes('OGRENCI') || type.includes('ÖĞRENCİ')) return UserDef.Ogrenci;
    if (type.includes('VELI') || type.includes('VELİ')) return UserDef.Veli;
    if (type.includes('YETKILI') || type.includes('YETKİLİ')) return UserDef.Authority;
    if (type.includes('OGRETMEN') || type.includes('ÖĞRETMEN')) return UserDef.Ogretmen;
    return 0;
  }

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
      cardid: row.CardID || '',
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
      userType: row.UserType,
      veliSicilId: veliSicilId,
      veliAdSoyad: row.VeliAdSoyad,
      gelisServisPlaka: row.GelisServisPlaka,
      donusServisPlaka: row.DonusServisPlaka,
      ogrencilerSinif: row.OgrencilerSinif ?? null,
      ogrenciKampusleri: row.OgrenciKampusleri ?? null,
    };
  }

  private assertUserDef(personData: PersonInsertRequest | null | undefined): void {
    if (!personData || personData.userdef == null) {
      throw new Error(
        `userdef zorunludur (${UserDef.Ogrenci}: Öğrenci, ${UserDef.Ogretmen}: Öğretmen, ${UserDef.Veli}: Veli).`,
      );
    }
  }

  insertPerson(personData: PersonInsertRequest): Observable<Person[]> {
    this.assertUserDef(personData);

    const payload = this.buildPersonPayload(personData, 'i', 0);
    return this.http.post<Person[]>(`${this.config.apiUrl}/Person`, payload);
  }

  updatePerson(personData: PersonInsertRequest & { id: number }): Observable<Person[]> {
    this.assertUserDef(personData);

    const payload = this.buildPersonPayload(personData, 'u', personData.id);
    return this.http.post<Person[]>(`${this.config.apiUrl}/Person`, payload);
  }

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

  terminatePerson(
    sicilIds: number[],
    nedenId: number,
    cikisTarihi: string,
  ): Observable<OperationResultResponse> {
    const sicilIdString = sicilIds.join('#');

    return this.api
      .callEndpoint<OperationResultResponse>('Dynamic', {
        islemtipi: 'c',
        point: 'sicil',
        sicilid: sicilIdString,
        neden: nedenId,
        cikistarih: cikisTarihi,
        type: 'cikis',
      })
      .pipe(map((response) => unwrapResponse(response) as OperationResultResponse));
  }

  requestLeave(leaveRequest: PersonLeaveRequest): Observable<LeaveRequestResponse[]> {
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

  assignLeave(params: PersonLeaveAssignParams): Observable<OperationResultResponse[]> {
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
      kapi: params.kapi,
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

  restorePerson(sicilId: number, girisTarihi: string): Observable<OperationResultResponse> {
    return this.api
      .callEndpoint<OperationResultResponse[]>('Dynamic', {
        islemtipi: 'c',
        point: 'sicil',
        sicilid: sicilId,
        neden: 0,
        cikistarih: girisTarihi,
        type: 'donus',
      })
      .pipe(map((response) => unwrapResponse(response) as OperationResultResponse));
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

  sendLoginInfo(sicilIds: readonly number[]): Observable<LoginSendResult> {
    return this.api
      .callEndpoint<unknown>('Dynamic', {
        point: 'loginsendcampus',
        islemtipi: 'd',
        xsicilid: toSicilIdList(sicilIds),
      })
      .pipe(map(parseLoginSendResponse));
  }
}
