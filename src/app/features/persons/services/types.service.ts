import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { map } from 'rxjs/operators';

export interface DropdownItem {
  id: number;
  ad: string;
  extra?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TypesService {
  private api = inject(ApiHelperService);

  getDropdownList(kaynak: string, id = 0): Observable<DropdownItem[]> {
    return this.api.callEndpoint<DropdownItem[]>('Type', {
      kaynak,
      islemtipi: 's',
      id,
    });
  }

  getTerminals(): Observable<DropdownItem[]> {
    return this.api
      .callEndpoint<any[]>('Dynamic', {
        point: 'MeCampusterminal',
        islemtipi: 's',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.id,
            ad: row.terminalname, // DB'den gelen 'terminalname'i UI'ın beklediği 'ad' alanına bağlıyoruz
          })),
        ),
      );
  }
}
