import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { LastPassRecord, TerminalGroup } from '../models/last-pass.model';

@Injectable({
  providedIn: 'root',
})
export class LastPassService {
  private api = inject(ApiHelperService);

  // sp_lastpass_tl (Terminal List)
  getTerminalGroups(): Observable<TerminalGroup[]> {
    return this.api
      .callEndpoint<any[]>('Dynamic', {
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

  // sp_lastpass_pp (Last Passes by Group)
  getRecentPassesByGroup(terminalGroupId: number): Observable<LastPassRecord[]> {
    return this.api
      .callEndpoint<any[]>('Dynamic', {
        point: 'lastpass',
        islemtipi: 'pp',
        terminalgrubu: terminalGroupId,
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            personId: row.SicilId,
            photoBase64: row.FotoImage,
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
