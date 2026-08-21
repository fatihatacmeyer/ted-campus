import { Person } from '../../core/models/person.model';
import {
  ColumnDef,
  uniqueFilterOptions,
} from '../components/customizable-table/customizable-table';

/**
 * Person listeleri için ortak sütun tanımları.
 * `person-crud` sayfası bu tanımları kullanır; userdef'a göre başlık
 * override'ları ve dışa aktarma hook'ları sayfada uygulanır.
 */
export const PERSON_COLUMNS: ColumnDef<Person>[] = [
  { field: 'ad', header: 'Ad', sortable: true, alwaysVisible: true },
  { field: 'soyad', header: 'Soyad', sortable: true, alwaysVisible: true },
  { field: 'sicilno', header: 'Sicil No', sortable: true },
  {
    field: 'firmaad',
    header: 'Firma',
    sortable: true,
    filterType: 'select',
    filterOptions: (rows) => uniqueFilterOptions(rows, 'firmaad'),
  },
  {
    field: 'bolumad',
    header: 'Bölüm',
    sortable: true,
    filterType: 'select',
    filterOptions: (rows) => uniqueFilterOptions(rows, 'bolumad'),
  },
  {
    field: 'pozisyonad',
    header: 'Pozisyon',
    sortable: true,
    filterType: 'select',
    filterOptions: (rows) => uniqueFilterOptions(rows, 'pozisyonad'),
  },
  { field: 'ceptelefon', header: 'Telefon' },
  { field: 'id', header: 'ID', sortable: true },
  { field: 'personelno', header: 'Personel No', sortable: true },
  { field: 'veliAdSoyad', header: 'Veli', sortable: true },
  { field: 'userid', header: 'User ID' },
  { field: 'altfirmaad', header: 'Alt Firma' },
  { field: 'direktorlukad', header: 'Direktörlük' },
  { field: 'gorevad', header: 'Görev' },
  { field: 'yakaad', header: 'Yaka' },
  { field: 'credit', header: 'Kredi' },
  { field: 'indirimorani', header: 'İndirim Oranı' },
  { field: 'mesaiperiyodu', header: 'Mesai Periyodu' },
  { field: 'mesaiperiyoduad', header: 'Mesai Periyodu Adı' },
  { field: 'cikistarih', header: 'Çıkış Tarihi' },
  { field: 'lyetki', header: 'L Yetki' },
  { field: 'lkademe', header: 'L Kademe' },
  { field: 'userdef', header: 'User Def' },
  { field: 'userdefad', header: 'User Def Adı' },
  { field: 'cardid', header: 'Kart ID' },
  { field: 'yetkistr', header: 'Yetki Str' },
  { field: 'yetkistrad', header: 'Yetki Str Adı' },
];

/** Varsayılan görünür sütunlar (kullanıcı tercihi olmadığında / sıfırlamada) */
export const PERSON_DEFAULT_FIELDS: string[] = [
  'ad',
  'soyad',
  'firmaad',
  'bolumad',
  'direktorlukad',
  'ceptelefon',
];
