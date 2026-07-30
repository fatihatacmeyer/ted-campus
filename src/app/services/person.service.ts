import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap, map } from 'rxjs';
import { APP_CONFIG, AppConfig } from './app-config.service';
import { Person, PersonInsertRequest, PersonLeaveRequest, PersonLeaveAssignParams, OperationResultResponse, ExitReason, UserDef, LeaveRequestResponse, ReportLinkResponse, extractLinkedPersonIds, extractLinkedTeacherIds, buildLinkedPersonelno } from '../core/person.model';
import { AuthService } from './auth.service';
import { PrepareService } from './prepare.service';

@Injectable({
  providedIn: 'root',
})
export class PersonService {
  private http = inject(HttpClient);
  private config: AppConfig = inject(APP_CONFIG);
  private authService = inject(AuthService);
  private prepareService = inject(PrepareService);

  /**
   * key=value çiftlerini backend'in beklediği "param" string formatına çevirir.
   * NOT: Legacy sistem (bkz. app_sicil.js) bu değerleri hiçbir zaman
   * encodeURIComponent ile encode etmiyor — çünkü tüm string zaten AES ile
   * şifrelenip gönderiliyor (bkz. PrepareService), backend de şifreyi çözdükten
   * sonra basit bir '&'/'=' split'i ile parse ediyor; URL-encoding beklemiyor.
   * Burada da encode etmiyoruz, aksi halde backend "%20" gibi karakterleri
   * literal metin olarak okur.
   */
  private buildParamString(params: Record<string, string | number>): string {
    return Object.entries(params)
      .map(([key, value]) => `${key}=${value ?? ''}`)
      .join('&');
  }

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
    const paramString = this.buildParamString({
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
    const apiUrl = `${this.config.apiUrl}/PersonList`;

    const paramString = this.buildParamString({
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

    const payload = { param: this.prepareService.prepare(paramString) };

    return this.http.post<Person[]>(apiUrl, payload);
  }

  /**
   * Yeni sicil (öğrenci / öğretmen / veli) ekler.
   * Hangi component'ten çağrıldığı fark etmez; ayrımı `personData.userdef` yapar.
   */
  insertPerson(personData: PersonInsertRequest): Observable<unknown> {
    if (!personData || personData.userdef == null) {
      throw new Error(`userdef zorunludur (${UserDef.Ogrenci}: Öğrenci, ${UserDef.Ogretmen}: Öğretmen, ${UserDef.Veli}: Veli).`);
    }

    const payload = this.buildPersonPayload(personData, 'i', 0);
    return this.http.post<unknown>(`${this.config.apiUrl}/Person`, payload);
  }

  /**
   * Mevcut bir sicil kaydını günceller.
   * insertPerson ile aynı payload yapısını kullanır; fark olarak
   * `islemtipi: 'u'` ve gerçek `id` gönderilir.
   */
  updatePerson(personData: PersonInsertRequest & { id: number }): Observable<unknown> {
    if (!personData || personData.userdef == null) {
      throw new Error(`userdef zorunludur (${UserDef.Ogrenci}: Öğrenci, ${UserDef.Ogretmen}: Öğretmen, ${UserDef.Veli}: Veli).`);
    }

    const payload = this.buildPersonPayload(personData, 'u', personData.id);
    return this.http.post<unknown>(`${this.config.apiUrl}/Person`, payload);
  }

  /**
   * Bidirectional parent-child sync: When a person's linked persons change,
   * add/remove that personId from the target's personelno field.
   * Also handles teacher links (T: prefix).
   * Fire-and-forget — errors logged, never blocks the user.
   */
  updatePersonLinks(personId: number, newLinkedIds: number[], allPersons: Person[]): void {
    for (const target of allPersons) {
      if (target.id === personId) continue;

      const currentParentIds = extractLinkedPersonIds(target.personelno);
      const currentTeacherIds = extractLinkedTeacherIds(target.personelno);
      const hasLink = currentParentIds.includes(personId);
      const shouldHaveLink = newLinkedIds.includes(target.id);

      if (shouldHaveLink && !hasLink) {
        const updated = [...currentParentIds, personId];
        this.updateLinkedPerson(target, updated, currentTeacherIds);
      } else if (!shouldHaveLink && hasLink) {
        const updated = currentParentIds.filter(id => id !== personId);
        this.updateLinkedPerson(target, updated, currentTeacherIds);
      }
    }
  }

  /**
   * Bidirectional teacher-student sync: When a student's linked teachers change,
   * add/remove the studentId from the teacher's personelno T: field.
   * Fire-and-forget — errors logged, never blocks the user.
   */
  updateTeacherLinks(studentId: number, newTeacherIds: number[], allPersons: Person[]): void {
    for (const target of allPersons) {
      if (target.id === studentId) continue;
      if (target.userdef !== UserDef.Ogretmen) continue; // only sync to teachers

      const currentParentIds = extractLinkedPersonIds(target.personelno);
      const currentTeacherIds = extractLinkedTeacherIds(target.personelno);
      const hasLink = currentTeacherIds.includes(studentId);
      const shouldHaveLink = newTeacherIds.includes(target.id);

      if (shouldHaveLink && !hasLink) {
        const updated = [...currentTeacherIds, studentId];
        this.updateLinkedPerson(target, currentParentIds, updated);
      } else if (!shouldHaveLink && hasLink) {
        const updated = currentTeacherIds.filter(id => id !== studentId);
        this.updateLinkedPerson(target, currentParentIds, updated);
      }
    }
  }

  private updateLinkedPerson(person: Person, linkedIds: number[], teacherIds: number[] = []): void {
    const payload: PersonInsertRequest & { id: number } = {
      id: person.id,
      ad: person.ad || '',
      soyad: person.soyad || '',
      firma: person.firma || '',
      bolum: person.bolum || '',
      pozisyon: person.pozisyon || '',
      gorev: person.gorev || '',
      altfirma: person.altfirma || '',
      yaka: person.yaka || '',
      direktorluk: person.direktorluk || '',
      sicilno: person.sicilno || '',
      personelno: person.personelno || '',
      cardid: person.cardid || '',
      adres: ' ',
      ceptelefon: person.ceptelefon || '',
      userdef: person.userdef,
    };

    // Write linked IDs into personelno with both P: and T: prefixes
    payload.personelno = buildLinkedPersonelno(linkedIds, teacherIds);

    this.updatePerson(payload).subscribe({
      error: (err) => console.error('[updatePersonLinks] Sync error for person', person.id, err),
    });
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
        const dynamicParam = this.buildParamString({
          point: 'SicilIslem',
          islemtipi: 'u',
          Deger: sicilno,
        });
        const encryptedDynamic = this.prepareService.prepare(dynamicParam);
        const dynamicUrl = `${this.config.apiUrl}/Dynamic?Name=${encodeURIComponent(encryptedDynamic)}`;

        return this.http.get<unknown>(dynamicUrl);
      }),
    );
  }

  terminatePerson(sicilIds: number[], nedenId: number, cikisTarihi: string): Observable<unknown> {
    const sicilIdString = sicilIds.join('#');

    const paramString = this.buildParamString({
      islemtipi: 'c',
      point: 'sicil',
      sicilid: sicilIdString,
      neden: nedenId,
      cikistarih: cikisTarihi,
      type: 'cikis',
    });

    const encryptedParam = this.prepareService.prepare(paramString);

    const apiUrl = `${this.config.apiUrl}/Dynamic?Name=${encodeURIComponent(encryptedParam)}`;

    return this.http.get<unknown>(apiUrl);
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

    const paramString = this.buildParamString(params);
    const encryptedParam = this.prepareService.prepare(paramString);

    const apiUrl = `${this.config.apiUrl}/Dynamic?Name=${encodeURIComponent(encryptedParam)}`;

    return this.http.get<LeaveRequestResponse[]>(apiUrl);
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

    const encryptedParam = this.prepareService.prepare(paramString);
    const user = this.authService.currentUserValue;
    const payload = {
      param: encryptedParam,
      tokenid: user?.tokenid || '',
    };

    console.log('[assignLeave] RAW param:', paramString);
    console.log('[assignLeave] Encrypted:', encryptedParam);
    console.log('[assignLeave] Token:', user?.tokenid);

    return this.http.post<OperationResultResponse[] | OperationResultResponse>(`${this.config.apiUrl}/TA`, payload).pipe(
      tap((raw) => console.log('[assignLeave] RAW response:', JSON.stringify(raw))),
      map((raw) => {
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') return [raw];
        console.error('[assignLeave] Beklenmeyen response:', raw);
        return [];
      }),
    );
  }

  getLeaveReport(formid: string): Observable<ReportLinkResponse[]> {
    const params = {
      islemtipi: 's',
      reportid: 'IZINFORM',
      params: `id:${formid}`,
      islemno: 1,
    };

    const paramString = this.buildParamString(params);
    const encryptedParam = this.prepareService.prepare(paramString);

    const apiUrl = `${this.config.apiUrl}/report?Name=${encodeURIComponent(encryptedParam)}`;

    return this.http.get<ReportLinkResponse[]>(apiUrl);
  }

  restorePerson(sicilId: number, girisTarihi: string): Observable<unknown> {
    const paramString = this.buildParamString({
      islemtipi: 'c',
      point: 'sicil',
      sicilid: sicilId,
      neden: 0,
      cikistarih: girisTarihi,
      type: 'donus',
    });

    const encryptedParam = this.prepareService.prepare(paramString);
    const apiUrl = `${this.config.apiUrl}/Dynamic?Name=${encodeURIComponent(encryptedParam)}`;

    return this.http.get<unknown>(apiUrl);
  }

  getExitReasons(): Observable<ExitReason[]> {
    const paramString = this.buildParamString({
      kaynak: 'access',
      point: 'gridcbo',
      islemtipi: 's',
      id: 0,
    });

    const encryptedParam = this.prepareService.prepare(paramString);
    const apiUrl = `${this.config.apiUrl}/Dynamic?Name=${encodeURIComponent(encryptedParam)}`;

    return new Observable<ExitReason[]>((observer) => {
      this.http.get<unknown>(apiUrl).subscribe({
        next: (data) => {
          const items = (Array.isArray(data) ? data : []) as ExitReason[];
          observer.next(items);
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }
}
