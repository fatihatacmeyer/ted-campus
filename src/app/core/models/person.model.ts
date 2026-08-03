/** Backend'deki userdef değerlerini temsil eden enum. */
export enum UserDef {
  Ogrenci = 11,
  Ogretmen = 13,
  Veli = 12,
}

export function getUserDefLabel(userdef: number): string {
  switch (userdef) {
    case UserDef.Ogrenci:
      return 'Öğrenci';
    case UserDef.Ogretmen:
      return 'Öğretmen';
    case UserDef.Veli:
      return 'Veli';
    default:
      return 'Personel';
  }
}

export function getUserDefBadgeClass(userdef: number): string {
  switch (userdef) {
    case UserDef.Ogrenci:
      return 'badge-student';
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

  // Kişiler arası ilişki (öğrenci-veli bağlantısı) — serbest metin alanı
  okod1?: string;

  // Referans alanları — API hem ID hem text döndürebilir
  firma?: string; // Firma ID (backend'e update'te ID olarak gönderilir)
  firmaad: string; // Firma adı (görünen metin)
  bolum?: string; // Bölüm ID
  bolumad: string; // Bölüm adı
  pozisyon?: string; // Pozisyon ID
  pozisyonad: string; // Pozisyon adı
  altfirma?: string; // Alt firma ID
  altfirmaad: string; // Alt firma adı
  direktorluk?: string; // Directorate ID
  direktorlukad: string; // Directorate adı
  gorev?: string; // Görev ID
  gorevad: string; // Görev adı
  yaka?: string; // Yaka ID
  yakaad: string; // Yaka adı

  // Ek alanlar
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
}

/**
 * Yeni sicil (kayıt) ekleme isteği için kullanılan DTO.
 * Formdan gelen alanlar + hangi component'ten geldiğini belirten userdef.
 * Bakınız: UserDef enum'u.
 */
export interface PersonInsertRequest {
  // Kişisel Bilgiler
  ad: string;
  soyad: string;
  dogumtarih?: string;
  cinsiyet?: string;
  kangrubu?: string;

  // Kimlik / Numara
  sicilno?: string;
  personelno?: string;
  cardid?: string;

  // İletişim
  ceptelefon?: string;
  telefon1?: string;
  email?: string;

  // Adres
  adres?: string;
  il?: string;
  ilce?: string;

  // Kurumsal
  firma?: string;
  okod1?: string;
  bolum?: string;
  pozisyon?: string;
  gorev?: string;
  altfirma?: string;
  direktorluk?: string;
  yaka?: string;
  giristarih?: string;

  // Sistem
  userdef: number;

  // Fotoğraf (base64 data-URL veya null)
  fotoImage?: string | null;
}

/** Backend'in Person/Login gibi endpoint'lerden döndüğü ortak sonuç formatı. */
export interface OperationResultResponse {
  islemsonuc: number | string;
  islemno?: string;
  sunucucevap?: string | null;
}

/**
 * Login sonrası dönen kullanıcı modeli.
 * Backend hem Person alanlarını hem de auth alanlarını (tokenid, islemno vb.) döner.
 */
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
  [key: string]: unknown; // Backend'in döndüğü ek alanlar için open-ended
}

/** Ayrılış nedeni dropdown seçeneği */
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

/**
 * İzin talebi sonucu (talepkaydet).
 * Legacy: talepkaydet() → { sonuc: number, formid: string }
 */
export interface LeaveRequestResponse {
  sonuc: number;
  formid: string;
}

/** PDF rapor linki */
export interface ReportLinkResponse {
  link: string;
}

export interface PersonLeaveRequest {
  bastarih: string; // start date (dd-mm-yyyy format)
  bittarih: string; // end date (dd-mm-yyyy format)
  siciller: string; // sicilno value (single person's sicilno string)
  tip: number; // fixed: 30
  islemtipi: string; // fixed: 'i'
  izinadresi: string; // leave address
  ulasim: number; // transport: 0 or 1
  yemek: number; // meal: 0 or 1
  aciklama: string; // description
  kaynak: string; // fixed: 'izin'
  point: string; // fixed: 'talep'
}

/** İzin tipi dropdown seçeneği — TypesService.getDropdownList('Izintipleri') dönüşü */
export interface LeaveType {
  id: number;
  ad: string;
}

/**
 * sp_izinatacampus_i prosedürüne gönderilen parametreler.
 * point=IzinataCampus & islemtipi=i & sicilid=... & tip=... & bastarih=... & bittarih=... & saatlikmi=... & aciklama=... & blok=...
 * /Dynamic endpoint'i üzerinden GET isteğiyle gider.
 */
export interface PersonLeaveAssignCampusParams {
  sicilid: number;
  tip: number;
  bastarih: string; // '2026-07-30T09:00' (DATETIME, T separator)
  bittarih: string; // '2026-07-30T18:00' (DATETIME, T separator)
  saatlikmi: number; // 0 | 1
  aciklama: string;
  blok: number; // 0 = gün bazlı, 1 = blok (her gün aynı saat)
}

/**
 * sp_pdks_ik prosedürüne gönderilen parametreler (islemtipi=ik).
 * Legacy: izinkaydet2() → POST /TA.
 */
export interface PersonLeaveAssignParams {
  islemtipi: string; // 'ik' (sabit)
  extra: string; // JSON.stringify([{sicilid, tarih, tarihbit}])
  tip: number; // izin tipi ID
  saatbas: string; // '09:00'
  saatbit: string; // '18:00'
  ucretli: boolean;
  saatlik: boolean;
  aciklama: string;
  sicilid: number; // 0 (legacy uyumu)
  tarih: string; // 'undefined' (legacy uyumu)
  tarihbit: string; // 'undefined' (legacy uyumu)
}

export function parseLinkedIds(raw: string | null | undefined): number[] {
  if (!raw || raw.trim() === '' || raw === '- - - - - - -') return [];
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

export function serializeLinkedIds(ids: number[]): string {
  return ids.filter((n) => !isNaN(n)).join(',');
}

export function resolveLinkedNames(ids: number[], allPersons: Person[]): LinkedPerson[] {
  if (ids.length === 0 || allPersons.length === 0) return [];
  const personMap = new Map(allPersons.map((p) => [p.id, p]));
  return ids.map((id) => {
    const found = personMap.get(id);
    return {
      id,
      name: found ? found.adsoyad : `Bilinmeyen (#${id})`,
      sicilno: found?.sicilno ?? '',
    };
  });
}

/**
 * personelno alanından linked person (veli) ID'lerini okur.
 * Format: "P:235,237 T:450,451" → [235, 237], ya da "00000234" → [] (prefix yok, boş).
 */
export function extractLinkedPersonIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const match = raw.match(/P:([0-9,\s]*)/);
  if (!match || !match[1].trim()) return [];
  return parseLinkedIds(match[1]);
}

/**
 * personelno alanından linked teacher (öğretmen) ID'lerini okur.
 * Format: "P:235,237 T:450,451" → [450, 451]
 */
export function extractLinkedTeacherIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const match = raw.match(/T:([0-9,\s]*)/);
  if (!match || !match[1].trim()) return [];
  return parseLinkedIds(match[1]);
}

/**
 * Linked person (veli) ve teacher (öğretmen) ID'lerinden personelno değeri üretir.
 * buildLinkedPersonelno([235, 237], [450, 451]) → "P:235,237 T:450,451"
 */
export function buildLinkedPersonelno(linkedIds: number[], teacherIds: number[] = []): string {
  const parts: string[] = [];
  if (linkedIds.length > 0) parts.push('P:' + linkedIds.join(','));
  if (teacherIds.length > 0) parts.push('T:' + teacherIds.join(','));
  return parts.join(' ');
}
