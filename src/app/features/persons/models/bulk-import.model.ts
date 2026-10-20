import { Person, PersonInsertRequest } from '../../../core/models/person.model';

/** Toplu aktarımın hedef kişi türü. */
export type ImportKind = 'student' | 'parent';

/** Şablondaki alanlar (PersonInsertRequest alan adlarıyla aynı) + veli şablonundaki ilişki kolonu. */
export type ImportField =
  | 'ad'
  | 'soyad'
  | 'sicilno'
  | 'personelno'
  | 'dogumtarih'
  | 'cinsiyet'
  | 'kangrubu'
  | 'cardid'
  | 'ceptelefon'
  | 'telefon1'
  | 'email'
  | 'adres'
  | 'il'
  | 'ilce'
  | 'firma'
  | 'direktorluk'
  | 'bolum'
  | 'altfirma'
  | 'giristarih'
  /** Yalnızca veli şablonu: velinin öğrencilerinin DB ID'leri. */
  | 'ogrenciler';

/** Excel'de ad ile yazılıp ID'ye çevrilen liste alanları. */
export type ImportLookupKey =
  | 'firma'
  | 'direktorluk'
  | 'bolum'
  | 'altfirma'
  | 'cinsiyet'
  | 'kangrubu';

export interface LookupOption {
  id: number;
  /** Excel'de görünen / yazılması beklenen ad. */
  ad: string;
  /** Aynı ID'ye çözülen ek yazımlar (örn. cinsiyet için DB değeri "E"). */
  aliases?: string[];
}

export type ImportLookups = Record<ImportLookupKey, LookupOption[]>;

/** Çevrilebilir kullanıcı mesajı: i18n anahtarı + parametreleri. */
export interface RowIssue {
  key: string;
  params?: Record<string, string | number>;
}

/** Excel'den okunan, henüz doğrulanmamış satır (hücre değerleri ham). */
export interface RawImportRow {
  /** Excel'deki satır numarası (1 tabanlı, başlık satırı 1). */
  rowNo: number;
  cells: Partial<Record<ImportField, unknown>>;
}

/**
 * ready  → yeni kayıt eklenecek
 * update → sistemdeki tek eşleşen öğrenci güncellenecek ("Mevcut kayıtları güncelle" açıkken)
 * exists → sistemde zaten var (öğrencide atlanır; velide yalnızca yeni ilişkiler eklenir)
 * error  → düzeltilmesi gereken sorun var
 */
export type ImportRowStatus = 'ready' | 'update' | 'exists' | 'error';
/** partial: veli eklendi ama bazı ilişkiler kurulamadı. */
export type ImportOutcomeStatus = 'imported' | 'partial' | 'failed';

/** Güncellenecek satırda bir alanın okunur eski ve yeni değeri. */
export interface FieldChange {
  /** Alanın Excel başlığı (örn. 'Sınıf / Şube'). */
  field: string;
  /** Sistemdeki değer; boşsa ''. */
  from: string;
  to: string;
}

export interface ImportRow {
  rowNo: number;
  ad: string;
  soyad: string;
  /** TC Kimlik No (öğrenci ve veli için tekrar kontrolünde kullanılan anahtar). */
  key: string;
  /** Yalnızca status === 'ready' veya 'update' iken dolu. */
  payload: PersonInsertRequest | null;
  status: ImportRowStatus;
  issues: RowIssue[];
  /** Sistemde kayıtlı kişinin ID'si (veli: 'exists', öğrenci: 'update'). */
  existingId: number | null;
  /** Veli: bu aktarımda kurulacak yeni ilişkilerin öğrenci ID'leri. */
  relationStudentIds: number[];
  /** Veli: satırda belirtilip sistemde zaten ilişkili olan öğrenci sayısı. */
  alreadyLinked: number;
  /** Öğrenci 'update': değişecek alanlar (eski → yeni). */
  changes?: FieldChange[];
  /** Aktarım sonrası doldurulur. */
  outcome?: ImportOutcomeStatus;
  outcomeIssue?: RowIssue;
}

/** Bir kişi kaydının (öğrenci/veli) eklenme sonucu. */
export interface ImportOutcome {
  rowNo: number;
  ok: boolean;
  /** Eklenen kaydın DB ID'si (yanıttan okunabildiyse). */
  id?: number;
  /** Başarısızlıkta sunucunun döndürdüğü metin (varsa). */
  message?: string;
}

/** Aktarım akışından yayımlanan olaylar (ilerleme + sonuçlar). */
export type ImportEvent =
  | { type: 'record'; outcome: ImportOutcome }
  | { type: 'relationsStart'; total: number }
  | { type: 'relationAttempt' }
  | { type: 'relationResult'; rowNo: number; studentId: number; ok: boolean };

/** Sayfa (sheet) matrisinin ayrıştırılmış hali. */
export interface ParsedSheet {
  rows: RawImportRow[];
  unknownHeaders: string[];
  /** Bulunamayan zorunlu sütunların Excel başlıkları. */
  missingRequired: string[];
}

/** Doğrulamanın dayandığı, sistemden okunan mevcut veriler. */
export interface ValidationContext {
  lookups: ImportLookups;
  /** Sistemdeki öğrenciler, TC Kimlik No'ya (normalizeKey ile) göre gruplu. */
  existingStudentsByTc: Map<string, Person[]>;
  /** Sistemdeki öğrenci ID'leri. */
  studentIds: Set<number>;
  /** Sistemdeki velilerin TC (normalizeKey) → ID haritası. */
  existingParentIdsByTc: Map<string, number>;
  /** Mevcut ilişkiler: "ogrenciId:veliId". */
  relationKeys: Set<string>;
}

/** Doğrulama seçenekleri. */
export interface ValidationOptions {
  /** Öğrenci: TC'si sistemde tek kayıtla eşleşen satırlar atlanmak yerine güncellenir. */
  updateExisting?: boolean;
}
