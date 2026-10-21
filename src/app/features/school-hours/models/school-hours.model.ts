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

  GunlerVeSiciller?: string;
}

export interface DBResult {
  Sonuc: number | string;
  SunucuCevap: string;
}
