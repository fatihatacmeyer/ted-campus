import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { APP_CONFIG, AppConfig } from './app-config.service';
import { User } from '../core/person.model';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private config: AppConfig = inject(APP_CONFIG);

  private currentUserSubject: BehaviorSubject<User | null>;

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  constructor() {
    const storedUser = this.getAuthFromLocalStorage();

    this.currentUserSubject = new BehaviorSubject<User | null>(storedUser);
  }

  login(email: string, password: string, securityCode = ''): Observable<User> {
    const apiUrl = `${this.config.apiUrl}/Login`;

    const loginParamString = `LoginName=${encodeURIComponent(email)}&Password=${encodeURIComponent(password)}&ldap=0&SecurityCode=${securityCode}`;

    const today = new Date();
    const mm = today.getMonth() + 1;
    const dd = today.getDate();
    const monthStr = (mm > 9 ? '' : '0') + mm;
    const dayStr = (dd > 9 ? '' : '0') + dd;
    const yearStr = today.getFullYear().toString();
    const keyStr = `${yearStr}${monthStr}${dayStr}${monthStr}${yearStr}${dayStr}`;

    const key = CryptoJS.enc.Utf8.parse(keyStr);
    const iv = CryptoJS.enc.Utf8.parse(keyStr);

    const encryptedParam = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(loginParamString), key, {
      keySize: 128 / 8,
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const payload = { param: encryptedParam.toString() };

    return this.http.post<unknown>(apiUrl, payload).pipe(
      map((response) => {
        const user = (Array.isArray(response) ? response[0] : response) as User;
        if (user && (user.islemsonuc == '1' || user.islemsonuc == 1)) {
          this.setAuthToLocalStorage(user);
          this.currentUserSubject.next(user);
          return user;
        } else {
          throw new Error('Kullanıcı adı veya şifre hatalı');
        }
      }),
      catchError((err) => {
        throw err;
      }),
    );
  }

  logout() {
    const authLocalStorageToken = `${this.config.appVersion}-${this.config.USERDATA_KEY}`;
    sessionStorage.removeItem(authLocalStorageToken);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private setAuthToLocalStorage(auth: User) {
    const authLocalStorageToken = `${this.config.appVersion}-${this.config.USERDATA_KEY}`;
    sessionStorage.setItem(authLocalStorageToken, JSON.stringify(auth));
  }

  private getAuthFromLocalStorage(): User | null {
    try {
      const authLocalStorageToken = `${this.config.appVersion}-${this.config.USERDATA_KEY}`;
      const lsValue = sessionStorage.getItem(authLocalStorageToken);
      if (!lsValue) return null;
      return JSON.parse(lsValue) as User;
    } catch {
      return null;
    }
  }
}
