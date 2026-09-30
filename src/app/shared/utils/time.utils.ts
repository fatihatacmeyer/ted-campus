/**
 * "HH:MM" maskeli saat inputları için framework'ten tamamen bağımsız,
 * saf (pure) yardımcı fonksiyonlar. Herhangi bir Angular bağımlılığı yok,
 * bu sayede tek başına unit test edilebilir ve tek bir yerde bakım yapılır.
 */

const TIME_REGEX = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const EMPTY_LIKE_VALUES = new Set(['00:00', '00:00:00', '-']);

export function isValidTime(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return TIME_REGEX.test(trimmed) && trimmed !== '00:00';
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** 4 haneli ham rakamdan "HH:MM" üretir (saat/dakika üst sınırlara kırpılır). */
export function digitsToTime(rawDigits: string): string {
  const h = Math.min(parseInt(rawDigits.slice(0, 2), 10), 23);
  const m = Math.min(parseInt(rawDigits.slice(2, 4), 10), 59);
  return `${pad(h)}:${pad(m)}`;
}

/** Kullanıcı input'tan çıktığında (blur) alanı temiz bir "HH:MM" değerine (ya da '') normalize eder. */
export function finalizeTimeValue(rawValue: string): string {
  const value = (rawValue || '').trim();
  if (!value || EMPTY_LIKE_VALUES.has(value)) return '';

  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 0) return '';

  if (digits.length <= 2) {
    const h = Math.min(parseInt(digits, 10), 23);
    return `${pad(h)}:00`;
  }

  if (digits.length === 3) {
    const h = parseInt(digits.slice(0, 1), 10);
    const m = Math.min(parseInt(digits.slice(1), 10), 59);
    return `0${h}:${pad(m)}`;
  }

  return digitsToTime(digits);
}

export interface CaretEdit {
  value: string;
  caret: number;
}

/** 5 karakterlik "HH:MM" değerinde imleç konumuna göre tek bir rakamın üzerine yazar. */
export function applyDigitAtCaret(current: string, caret: number, digit: string): CaretEdit | null {
  if (current.length !== 5 || current[2] !== ':') return null;
  const chars = current.split('');

  switch (caret) {
    case 0:
      chars[0] = digit;
      return { value: chars.join(''), caret: 1 };
    case 1:
      chars[1] = digit;
      return { value: chars.join(''), caret: 3 };
    case 2:
    case 3:
      chars[3] = digit;
      return { value: chars.join(''), caret: 4 };
    case 4:
      chars[4] = digit;
      return { value: chars.join(''), caret: 5 };
    default:
      return null;
  }
}

/** Backspace tuşunda imleç konumundaki haneyi '0' yaparak temizler. */
export function applyBackspaceAtCaret(current: string, caret: number): CaretEdit | null {
  if (current.length !== 5 || current[2] !== ':') return null;
  const chars = current.split('');

  if (caret === 3) {
    chars[1] = '0';
    return { value: chars.join(''), caret: 1 };
  }
  if (caret === 1 || caret === 4 || caret === 5) {
    const targetIndex = caret === 5 ? 4 : caret - 1;
    chars[targetIndex] = '0';
    return { value: chars.join(''), caret: targetIndex };
  }
  return null;
}

/** İki saat de doluysa başlangıç < bitiş olmalı; eksikse (henüz) geçerli sayılır. */
export function isIntervalValid(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!isValidTime(start) || !isValidTime(end)) return true;
  return start! < end!;
}
