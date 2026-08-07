import { describe, expect, it } from 'vitest';
import { computePeriodRange, formatTime } from './date.utils';

describe('computePeriodRange', () => {
  it('gun: verilen tarihin kendisini döndürür', () => {
    const range = computePeriodRange('gun', new Date(2026, 7, 6)); // 2026-08-06
    expect(range).toEqual({ baslangic: '2026-08-06', bitis: '2026-08-06' });
  });

  it('hafta: çarşamba günü için Pazartesi-Pazar aralığını döndürür', () => {
    // 2026-08-05 Çarşamba
    const range = computePeriodRange('hafta', new Date(2026, 7, 5));
    expect(range).toEqual({ baslangic: '2026-08-03', bitis: '2026-08-09' });
  });

  it('hafta: pazartesi günü kendinden başlar', () => {
    // 2026-08-03 Pazartesi
    const range = computePeriodRange('hafta', new Date(2026, 7, 3));
    expect(range).toEqual({ baslangic: '2026-08-03', bitis: '2026-08-09' });
  });

  it('hafta: pazar günü bir önceki haftaya ait pazartesiden başlar', () => {
    // 2026-08-09 Pazar
    const range = computePeriodRange('hafta', new Date(2026, 7, 9));
    expect(range).toEqual({ baslangic: '2026-08-03', bitis: '2026-08-09' });
  });

  it('hafta: yıl sınırını aşar', () => {
    // 2026-01-01 Perşembe -> hafta 2025-12-29 / 2026-01-04
    const range = computePeriodRange('hafta', new Date(2026, 0, 1));
    expect(range).toEqual({ baslangic: '2025-12-29', bitis: '2026-01-04' });
  });

  it('ay: ayın ilk ve son gününü döndürür', () => {
    const range = computePeriodRange('ay', new Date(2026, 7, 6));
    expect(range).toEqual({ baslangic: '2026-08-01', bitis: '2026-08-31' });
  });

  it('ay: artık yıl şubatını doğru hesaplar', () => {
    const range = computePeriodRange('ay', new Date(2024, 1, 15));
    expect(range).toEqual({ baslangic: '2024-02-01', bitis: '2024-02-29' });
  });

  it('ay: artık olmayan yıl şubatını doğru hesaplar', () => {
    const range = computePeriodRange('ay', new Date(2026, 1, 15));
    expect(range).toEqual({ baslangic: '2026-02-01', bitis: '2026-02-28' });
  });
});

describe('formatTime', () => {
  it('T ayraçlı zaman damgasından saati döndürür', () => {
    expect(formatTime('2026-08-06T08:05:00')).toBe('08:05');
  });

  it('boşluk ayraçlı zaman damgasından saati döndürür', () => {
    expect(formatTime('2026-08-06 17:30:00')).toBe('17:30');
  });

  it('null/undefined/boş için boş string döndürür', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
  });

  it('saat içermeyen değer için boş string döndürür', () => {
    expect(formatTime('2026-08-06')).toBe('');
  });
});
