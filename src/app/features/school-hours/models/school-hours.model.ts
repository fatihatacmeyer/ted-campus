import { TimeFieldSuffix, WeekdayKey } from './weekday.model';

/**
 * Eskiden burada 28 satır (7 gün x 4 alan) elle yazılmış optional string
 * property vardı (PazartesiBas, PazartesiBit, PazartesiEtutluBas, ...).
 * WEEKDAYS ile aynı kaynaktan türeyen bu mapped type, aynı alan adlarını
 * tek satırda üretir; yeni bir gün eklemek gerekirse tek değişiklik yeri
 * weekday.model.ts olur.
 */
export type DayTimeFields = {
  [K in WeekdayKey as `${K}${TimeFieldSuffix}`]?: string;
};

export interface SchoolHours extends DayTimeFields {
  Id: number;
  CampusId: number;
  SinifId: number;
  SinifSeviyesi: string;
  Aciklama?: string;

  /** Toplu format: "SicilId;1,0,0,1,0,0,0-SicilId2;1,1,1,..." */
  GunlerVeSiciller?: string;
}

export interface DBResult {
  Sonuc: number | string;
  SunucuCevap: string;
}
