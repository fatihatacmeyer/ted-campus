import { TimeFieldSuffix, WeekdayKey } from './weekday.model';

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
