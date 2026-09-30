import { describe, expect, it } from 'vitest';
import {
  applyBackspaceAtCaret,
  applyDigitAtCaret,
  finalizeTimeValue,
  isIntervalValid,
  isValidTime,
} from './time.utils';

describe('isValidTime', () => {
  it('geçerli saatleri kabul eder, 00:00 ve bozuk değerleri reddeder', () => {
    expect(isValidTime('08:30')).toBe(true);
    expect(isValidTime('00:00')).toBe(false);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('8:30')).toBe(false);
    expect(isValidTime(undefined)).toBe(false);
  });
});

describe('finalizeTimeValue', () => {
  it('boş/"-" değerleri boşaltır', () => {
    expect(finalizeTimeValue('')).toBe('');
    expect(finalizeTimeValue('00:00')).toBe('');
    expect(finalizeTimeValue('-')).toBe('');
  });

  it('kısmi girişleri tamamlar ve sınırlara kırpar', () => {
    expect(finalizeTimeValue('9')).toBe('09:00');
    expect(finalizeTimeValue('930')).toBe('09:30');
    expect(finalizeTimeValue('2575')).toBe('23:59');
  });
});

describe('applyDigitAtCaret / applyBackspaceAtCaret', () => {
  it('rakamı imleç konumuna yazar ve iki noktayı atlar', () => {
    expect(applyDigitAtCaret('08:30', 1, '9')).toEqual({ value: '09:30', caret: 3 });
    expect(applyDigitAtCaret('08:30', 3, '4')).toEqual({ value: '08:40', caret: 4 });
  });

  it('backspace haneyi 0 yapar', () => {
    expect(applyBackspaceAtCaret('08:35', 5)).toEqual({ value: '08:30', caret: 4 });
    expect(applyBackspaceAtCaret('08:35', 3)).toEqual({ value: '00:35', caret: 1 });
  });
});

describe('isIntervalValid', () => {
  it('bitiş başlangıçtan büyük olmalı; eksik çift geçerli sayılır', () => {
    expect(isIntervalValid('08:00', '09:00')).toBe(true);
    expect(isIntervalValid('09:00', '08:00')).toBe(false);
    expect(isIntervalValid('09:00', undefined)).toBe(true);
  });
});
