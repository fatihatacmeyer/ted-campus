import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class HelperService {
  userLoginModel: any = {
    customerCode: '',
    fullname: '',
    username: '',
    loginname: '',
    gorev: null,
    yetki: null,
    bolum: null,
    kademe: null,
    xsicilid: null,
    extloginname: '',
    customerName: '',
    id: null,
    tokenid: '',
    islemno: '',
    access: '',
    accessmenu: true,
    admin: false,
  };

  constructor() {}
}
