import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from './app-config.service';
import { PrepareService } from './prepare.service';

/**
 * Backend ile iletişimin ortak kalıplarını tek yerde toplar.
 *
 * Legacy (AngularJS) sistemden devralınan iki temel desen vardır:
 *   1. GET  /{endpoint}?Name={AES-şifreli param}   — "Dynamic", "Type", "report" vb.
 *   2. POST /{endpoint} { param: AES-şifreli string } — "PersonList", "TA" vb.
 *
 * NOT: param string'i asla URL-encode edilmiyor — tüm string zaten AES ile
 * şifrelenip gönderildiği için backend basit bir '&'/'=' split'i ile parse
 * ediyor. (bkz. PrepareService) Bu yüzden buildParamString encode etmez.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiHelperService {
  private http = inject(HttpClient);
  private config: AppConfig = inject(APP_CONFIG);
  private prepareService = inject(PrepareService);

  /**
   * key=value çiftlerini backend'in beklediği "param" string formatına çevirir.
   * Ekleme sırası korunur (Object.entries insertion order) — backend sıralamaya
   * bağımlı olmasa da, şifrelenmiş çıktıyı değiştirmemek için sıraya dokunulmaz.
   */
  buildParamString(params: Record<string, string | number | null | undefined>): string {
    const result = Object.entries(params)
      .map(([key, value]) => `${key}=${value ?? ''}`)
      .join('&');

    console.log('[Req] plaintext param:', result);
    return result;
  }

  /**
   * GET /{endpoint}?Name={şifreli paramString}
   * Örnek: callEndpoint('Dynamic', {...}) → /Dynamic?Name=SCI!...
   */
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

  /**
   * POST /{endpoint} — body: { param: şifreli paramString, ...extra }
   * Örnek: postParam('PersonList', paramString) → { param: 'SCI!...' }
   *        postParam('TA', paramString, { tokenid }) → { param, tokenid }
   */
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
