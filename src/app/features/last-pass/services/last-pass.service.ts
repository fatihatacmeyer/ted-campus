import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { LastPassRecord, TerminalGroup } from '../models/last-pass.model';

interface TerminalGroupRow {
  Id: number;
  Ad: string;
}

interface LastPassRow {
  SicilId: number;
  FotoImage: string | null;
  ProfilFotoDosyaAdi?: string | null;
  KisiTipi?: string | null;
  SicilNo: string;
  AdSoyad: string;
  BolumAdi: string;
  FirmaAdi: string;
  Pozisyon: string;
  GecisZamani: string;
  TerminalID: number;
  TerminalAdi: string;
  Mesaj: string;
  Gecis: number;
}

@Injectable({
  providedIn: 'root',
})
export class LastPassService {
  private api = inject(ApiHelperService);

  getTerminalGroups(): Observable<TerminalGroup[]> {
    return this.api
      .callEndpoint<TerminalGroupRow[]>('Dynamic', {
        point: 'lastpass',
        islemtipi: 'tl',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.Id,
            name: row.Ad,
          })),
        ),
      );
  }

  getRecentPassesByGroup(terminalGroupId: number): Observable<LastPassRecord[]> {
    return this.api
      .callEndpoint<LastPassRow[]>('Dynamic', {
        point: 'lastpasscampus',
        islemtipi: 'pp',
        terminalgrubu: terminalGroupId,
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            personId: row.SicilId,
            photoBase64: row.FotoImage,
            profilePhotoFileName: row.ProfilFotoDosyaAdi ?? null,
            personType: row.KisiTipi ?? null,
            identityNo: row.SicilNo,
            fullName: row.AdSoyad,
            department: row.BolumAdi,
            company: row.FirmaAdi,
            position: row.Pozisyon,
            passTime: row.GecisZamani,
            terminalId: row.TerminalID,
            terminalName: row.TerminalAdi,
            message: row.Mesaj,
            status: row.Gecis,
          })),
        ),
      );
  }
}
