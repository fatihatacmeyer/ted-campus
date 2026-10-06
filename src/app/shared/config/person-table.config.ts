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
  { field: 'ad', header: 'PERSON_COLUMNS.AD', sortable: true, alwaysVisible: true },
  { field: 'soyad', header: 'PERSON_COLUMNS.SOYAD', sortable: true, alwaysVisible: true },
  { field: 'sicilno', header: 'PERSON_COLUMNS.SICIL_NO', sortable: true },
  {
    field: 'firmaad',
    header: 'PERSON_COLUMNS.FIRMA',
    sortable: true,
    filterType: 'select',
    filterOptions: (rows) => uniqueFilterOptions(rows, 'firmaad'),
  },
  {
    field: 'bolumad',
    header: 'PERSON_COLUMNS.BOLUM',
    sortable: true,
    filterType: 'select',
    filterOptions: (rows) => uniqueFilterOptions(rows, 'bolumad'),
  },
  {
    field: 'pozisyonad',
    header: 'PERSON_COLUMNS.POZISYON',
    sortable: true,
    filterType: 'select',
    filterOptions: (rows) => uniqueFilterOptions(rows, 'pozisyonad'),
  },
  { field: 'ceptelefon', header: 'PERSON_COLUMNS.PHONE' },
  { field: 'id', header: 'PERSON_COLUMNS.ID', sortable: true },
  { field: 'personelno', header: 'PERSON_COLUMNS.PERSONEL_NO', sortable: true },
  { field: 'veliAdSoyad', header: 'PERSON_COLUMNS.PARENT', sortable: true },
  { field: 'userid', header: 'PERSON_COLUMNS.USER_ID' },
  { field: 'altfirmaad', header: 'PERSON_COLUMNS.ALT_FIRMA' },
  { field: 'direktorlukad', header: 'PERSON_COLUMNS.DIREKTORLUK' },
  { field: 'gorevad', header: 'PERSON_COLUMNS.GOREV' },
  { field: 'yakaad', header: 'PERSON_COLUMNS.YAKA' },
  { field: 'credit', header: 'PERSON_COLUMNS.KREDI' },
  { field: 'indirimorani', header: 'PERSON_COLUMNS.INDIRIM_ORANI' },
  { field: 'mesaiperiyodu', header: 'PERSON_COLUMNS.MESAI_PERIYODU' },
  { field: 'mesaiperiyoduad', header: 'PERSON_COLUMNS.MESAI_PERIYODU_AD' },
  { field: 'cikistarih', header: 'PERSON_COLUMNS.CIKIS_TARIHI' },
  { field: 'lyetki', header: 'PERSON_COLUMNS.L_YETKI' },
  { field: 'lkademe', header: 'PERSON_COLUMNS.L_KADEME' },
  { field: 'userdef', header: 'PERSON_COLUMNS.USER_DEF' },
  { field: 'userdefad', header: 'PERSON_COLUMNS.USER_DEF_AD' },
  { field: 'cardid', header: 'PERSON_COLUMNS.CARD_ID' },
  { field: 'yetkistr', header: 'PERSON_COLUMNS.YETKI_STR' },
  { field: 'yetkistrad', header: 'PERSON_COLUMNS.YETKI_STR_AD' },
  { field: 'gelisServisPlaka', header: 'PERSON_COLUMNS.GELIS_SERVIS', sortable: true },
  { field: 'donusServisPlaka', header: 'PERSON_COLUMNS.DONUS_SERVIS', sortable: true },
  { field: 'ogrencilerSinif', header: 'PERSON_COLUMNS.STUDENTS_CLASS', sortable: true },
  { field: 'ogrenciKampusleri', header: 'PERSON_COLUMNS.STUDENT_CAMPUSES', sortable: true },
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
