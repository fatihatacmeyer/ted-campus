import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from './app-config.service';
import { PrepareService } from './prepare.service';

@Injectable({
  providedIn: 'root',
})
export class ApiHelperService {
  private http = inject(HttpClient);
  private config: AppConfig = inject(APP_CONFIG);
  private prepareService = inject(PrepareService);

  buildParamString(params: Record<string, string | number | null | undefined>): string {
    const result = Object.entries(params)
      .map(([key, value]) => `${key}=${value ?? ''}`)
      .join('&');

    console.log('[Req] plaintext param:', result);
    return result;
  }

  callEndpoint<T>(
    endpoint: string,
    params: Record<string, string | number | null | undefined>,
  ): Observable<T> {
    const paramString = this.buildParamString(params);
    const encryptedParam = this.prepareService.prepare(paramString);
    return this.http.get<T>(
      `${this.config.apiUrl}/${endpoint}?Name=${encodeURIComponent(encryptedParam)}`,
    );
  }

  postParam<T>(
    endpoint: string,
    paramString: string,
    extra: Record<string, unknown> = {},
  ): Observable<T> {
    const encryptedParam = this.prepareService.prepare(paramString);
    return this.http.post<T>(`${this.config.apiUrl}/${endpoint}`, {
      param: encryptedParam,
      ...extra,
    });
  }
}
