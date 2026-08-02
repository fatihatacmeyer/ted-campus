import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { APP_CONFIG, AppConfig } from './app-config.service';
import { User } from '../models/person.model';
import { encryptParam } from './prepare.service';
import { getTodayKeyParts } from '../utils/crypto-date.utils';

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

  private get storageKey(): string {
    return `${this.config.appVersion}-${this.config.USERDATA_KEY}`;
  }

  constructor() {
    const storedUser = this.getAuthFromSessionStorage();

    this.currentUserSubject = new BehaviorSubject<User | null>(storedUser);
  }

  login(email: string, password: string, securityCode = ''): Observable<User> {
    const apiUrl = `${this.config.apiUrl}/Login`;

    const loginParamString = `LoginName=${encodeURIComponent(email)}&Password=${encodeURIComponent(password)}&ldap=0&SecurityCode=${securityCode}`;

    const { iv } = getTodayKeyParts();
    const encryptedParam = encryptParam(loginParamString, iv, iv);

    const payload = { param: encryptedParam };

    return this.http.post<unknown>(apiUrl, payload).pipe(
      map((response) => {
        const user = (Array.isArray(response) ? response[0] : response) as User;
        if (user && (user.islemsonuc == '1' || user.islemsonuc == 1)) {
          this.setAuthToSessionStorage(user);
          this.currentUserSubject.next(user);
          return user;
        } else {
          throw new Error('Kullanıcı adı veya şifre hatalı');
        }
      }),
    );
  }

  logout() {
    const authLocalStorageToken = this.storageKey;
    sessionStorage.removeItem(authLocalStorageToken);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private setAuthToSessionStorage(auth: User) {
    const authLocalStorageToken = this.storageKey;
    sessionStorage.setItem(authLocalStorageToken, JSON.stringify(auth));
  }

  private getAuthFromSessionStorage(): User | null {
    try {
      const authLocalStorageToken = this.storageKey;
      const lsValue = sessionStorage.getItem(authLocalStorageToken);
      if (!lsValue) return null;
      return JSON.parse(lsValue) as User;
    } catch {
      return null;
    }
  }
}
