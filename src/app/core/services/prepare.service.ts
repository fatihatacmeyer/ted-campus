import { Injectable, inject } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { AuthService } from './auth.service';
import { getTodayKeyParts } from '../utils/crypto-date.utils';

/**
 * AES-CBC/Pkcs7 blok şifrelemenin ortak çekirdeği.
 * Anahtar ve IV her iki tarafta aynı şekilde türetilir:
 *  - AuthService.login:  key = iv = "yyyyMMddMMyyyydd" (kullanıcı henüz yok, SC yok)
 *  - PrepareService.prepare: key = "yyyyMMdd" + SC (islemno), iv = "yyyyMMddMMyyyydd"
 * Bu fonksiyon yalnızca CryptoJS çağrısını tekilleştirir; anahtar türetme
 * mantığı çağıran tarafta kalır (davranış değişmez).
 */
export function encryptParam(param: string, keyStr: string, ivStr: string): string {
  const key = CryptoJS.enc.Utf8.parse(keyStr);
  const iv = CryptoJS.enc.Utf8.parse(ivStr);

  const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(param), key, {
    keySize: 128 / 8,
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return encrypted.toString();
}

/**
 * Legacy (AngularJS) sistemdeki $rootScope.prepare() fonksiyonunun birebir karşılığı.
 *
 * Backend'e giden HER istek (liste, ekleme, güncelleme, silme...) bu şekilde
 * şifrelenmiş "SCI!<base64>" formatında bir param string'i bekliyor. Düz metin
 * gönderildiğinde backend hata fırlatmıyor, sessizce boş/anlamsız sonuç dönüyor
 * (bizim daha önce yaşadığımız "sicil eklenmedi" sorununun asıl kaynağı buydu).
 *
 * Anahtar türetme mantığı (legacy app_sicil.js + app.js'ten):
 *   keyStr = "yyyyMMdd" + SC
 *   ivStr  = "yyyyMMddMMyyyydd"
 *   SC     = login response'undaki "islemno" alanı (session'a özel, sabit değil!)
 *   Pin    = legacy sistemde hiçbir yerde set edilmiyor, her zaman boş kalıyor.
 */
@Injectable({
  providedIn: 'root',
})
export class PrepareService {
  private authService = inject(AuthService);

  prepare(param: string): string {
    const currentUser = this.authService.currentUserValue;
    const sc = currentUser && currentUser.islemno ? currentUser.islemno : '';

    const { key, iv } = getTodayKeyParts(sc);

    return 'SCI!' + encryptParam(param, key, iv);
  }
}
