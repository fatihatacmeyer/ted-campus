/**
 * Haftanın günleri için tek doğruluk kaynağı (single source of truth).
 * Hem SchoolHoursService (API alan adları) hem de bileşenler (gösterim/etkileşim)
 * bu listeyi paylaşır; böylece gün listesi iki ayrı yerde tekrar tanımlanmaz.
 */
export type WeekdayKey =
  | 'Pazartesi'
  | 'Sali'
  | 'Carsamba'
  | 'Persembe'
  | 'Cuma'
  | 'Cumartesi'
  | 'Pazar';

export interface WeekdayDef {
  readonly key: WeekdayKey;
  readonly headerKey: string;
  /** 1 (Pazartesi) .. 7 (Pazar) — backend'deki Gunler / GunlerVeSiciller sırasıyla birebir eşleşir. */
  readonly index: number;
}

export const WEEKDAYS: readonly WeekdayDef[] = [
  { key: 'Pazartesi', headerKey: 'DAYS.MONDAY', index: 1 },
  { key: 'Sali', headerKey: 'DAYS.TUESDAY', index: 2 },
  { key: 'Carsamba', headerKey: 'DAYS.WEDNESDAY', index: 3 },
  { key: 'Persembe', headerKey: 'DAYS.THURSDAY', index: 4 },
  { key: 'Cuma', headerKey: 'DAYS.FRIDAY', index: 5 },
  { key: 'Cumartesi', headerKey: 'DAYS.SATURDAY', index: 6 },
  { key: 'Pazar', headerKey: 'DAYS.SUNDAY', index: 7 },
] as const;

export const TIME_FIELD_SUFFIXES = ['Bas', 'Bit', 'EtutluBas', 'EtutluBit'] as const;
export type TimeFieldSuffix = (typeof TIME_FIELD_SUFFIXES)[number];

/** Örn: timeField('Pazartesi', 'EtutluBas') -> 'PazartesiEtutluBas' */
export function timeField(day: WeekdayKey, suffix: TimeFieldSuffix): string {
  return `${day}${suffix}`;
}
