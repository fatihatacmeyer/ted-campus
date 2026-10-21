export enum UserDef {
  Ogrenci = 11,
  Veli = 12,
  Authority = 13,
  Ogretmen = 14,
}

export function getUserDefLabel(userdef: number): string {
  switch (userdef) {
    case UserDef.Ogrenci:
      return 'Öğrenci';
    case UserDef.Authority:
      return 'Yetkili';
    case UserDef.Ogretmen:
      return 'Öğretmen';
    case UserDef.Veli:
      return 'Veli';
    default:
      return 'Personel';
  }
}

export function getUserDefLabelKey(userdef: number): string {
  switch (userdef) {
    case UserDef.Ogrenci:
      return 'USERDEF.STUDENT';
    case UserDef.Authority:
      return 'USERDEF.AUTHORITY';
    case UserDef.Ogretmen:
      return 'USERDEF.TEACHER';
    case UserDef.Veli:
      return 'USERDEF.PARENT';
    default:
      return 'USERDEF.STAFF';
  }
}

export function getUserDefBadgeClass(userdef: number): string {
  switch (userdef) {
    case UserDef.Ogrenci:
      return 'badge-student';
    case UserDef.Authority:
      return 'badge-authority';
    case UserDef.Ogretmen:
      return 'badge-teacher';
    case UserDef.Veli:
      return 'badge-parent';
    default:
      return 'badge-default';
  }
}

export interface Person {
  id: number;
  ad: string;
  soyad: string;
  adsoyad: string;
  sicilno: string;
  personelno: string;
  userid: string;

  okod1?: string;

  firma?: string;
  firmaad: string;
  bolum?: string;
  bolumad: string;
  pozisyon?: string;
  pozisyonad: string;
  altfirma?: string;
  altfirmaad: string;
  direktorluk?: string;
  direktorlukad: string;
  gorev?: string;
  gorevad: string;
  yaka?: string;
  yakaad: string;

  credit: number;
  indirimorani: number;
  ceptelefon: string;
  mesaiperiyodu: number;
  mesaiperiyoduad: string;
  cikistarih: string | null;
  lyetki: number;
  lkademe: number;
  userdef: number;
  userdefad: string;

  userType?: string;
  veliSicilId?: number;
  veliAdSoyad?: string;

  cardid: string;
  yetkistr: string;
  yetkistrad: string;
  islemno: string;
  islemsonuc: number;
  sunucucevap: string | null;

  dogumtarih?: string | null;
  cinsiyet?: string | null;
  kangrubu?: string | null;
  telefon1?: string | null;
  email?: string | null;
  adres?: string | null;
  il?: string | null;
  ilce?: string | null;
  giristarih?: string | null;

  gelisServisPlaka?: string;
  donusServisPlaka?: string;

  ogrencilerSinif?: string | null;
  ogrenciKampusleri?: string | null;
}

export interface PersonInsertRequest {
  ad: string;
  soyad: string;
  dogumtarih?: string;
  cinsiyet?: string;
  kangrubu?: string;

  sicilno?: string;
  personelno?: string;
  cardid?: string;

  ceptelefon?: string;
  telefon1?: string;
  email?: string;

  adres?: string;
  il?: string;
  ilce?: string;

  firma?: string;
  okod1?: string;
  bolum?: string;
  pozisyon?: string;
  gorev?: string;
  altfirma?: string;
  direktorluk?: string;
  yaka?: string;
  giristarih?: string;

  userdef: number;

  fotoImage?: string | null;
}

export interface OperationResultResponse {
  islemsonuc: number | string;
  islemno?: string;
  sunucucevap?: string | null;
}

export interface User {
  id: number | null;
  customerCode: string;
  fullname: string;
  username: string;
  loginname: string;
  gorev: string | null;
  yetki: number | null;
  bolum: string | null;
  kademe: string | null;
  xsicilid: number | null;
  extloginname: string;
  customerName: string;
  tokenid: string;
  islemno: string;
  access: string;
  accessmenu: boolean;
  admin: boolean;
  islemsonuc: number | string;
  [key: string]: unknown;
}

export interface ExitReason {
  tip: string;
  ad: string;
  id: number;
  [key: string]: unknown;
}

export interface LinkedPerson {
  id: number;
  name: string;
  sicilno?: string;
}

export interface RelationCampusRow {
  relid?: number | string;
  Id?: number | string;
  OgrenciSicilId?: number | string;
  VeliSicilId?: number | string;
  [key: string]: unknown;
}

export interface LeaveRequestResponse {
  sonuc: number;
  formid: string;
}

export interface ReportLinkResponse {
  link: string;
}

export interface PersonLeaveRequest {
  bastarih: string;
  bittarih: string;
  siciller: string;
  tip: number;
  islemtipi: string;
  izinadresi: string;
  ulasim: number;
  yemek: number;
  aciklama: string;
  kaynak: string;
  point: string;
}

export interface LeaveType {
  id: number;
  ad: string;
}

export interface PersonLeaveAssignCampusParams {
  sicilid: number;
  tip: number;
  bastarih: string;
  bittarih: string;
  saatlikmi: number;
  aciklama: string;
  blok: number;
  kapi: number;
}

export interface PersonLeaveAssignParams {
  islemtipi: string;
  extra: string;
  tip: number;
  saatbas: string;
  saatbit: string;
  ucretli: boolean;
  saatlik: boolean;
  aciklama: string;
  sicilid: number;
  tarih: string;
  tarihbit: string;
}
