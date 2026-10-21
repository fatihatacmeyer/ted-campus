import { Injectable, inject } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { AuthService } from './auth.service';
import { getTodayKeyParts } from '../utils/crypto-date.utils';

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
