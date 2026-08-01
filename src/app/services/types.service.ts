import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG, AppConfig } from './app-config.service';
import { PrepareService } from './prepare.service';

export interface DropdownItem {
  id: number;
  ad: string;
  extra?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TypesService {
  private http = inject(HttpClient);
  private config: AppConfig = inject(APP_CONFIG);
  private prepareService = inject(PrepareService);

  getDropdownList(kaynak: string, id: number = 0): Observable<DropdownItem[]> {
    const paramString = `kaynak=${kaynak}&islemtipi=s&id=${id}`;
    const encryptedParam = this.prepareService.prepare(paramString);

    const apiUrl = `${this.config.apiUrl}/Type?Name=${encodeURIComponent(encryptedParam)}`;

    return this.http
      .get<DropdownItem[]>(apiUrl)
      .pipe(tap((data) => console.log(`[TypesService] ${kaynak} sonucu:`, data)));
  }
}
