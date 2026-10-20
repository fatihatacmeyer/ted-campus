import { describe, expect, it } from 'vitest';
import { parseLoginSendResponse, summarizeNames, toSicilIdList } from './login-send.utils';

describe('toSicilIdList', () => {
  it('tek Id için eski biçimi korur', () => {
    expect(toSicilIdList([5])).toBe('5');
  });

  it('Id listesini ";" ile birleştirir, tekrarları ve geçersizleri atar', () => {
    expect(toSicilIdList([5, 6, 5, 0, -1, 1.5, NaN, 7])).toBe('5;6;7');
  });

  it('boş liste için boş metin döner', () => {
    expect(toSicilIdList([])).toBe('');
  });
});

describe('parseLoginSendResponse', () => {
  it('yeni prosedürün alan adlarını (Sonuc / SunucuCevap) okur', () => {
    expect(parseLoginSendResponse([{ Sonuc: 1, SunucuCevap: '3 kullanıcı' }])).toEqual({
      sonuc: 1,
      sunucuCevap: '3 kullanıcı',
    });
  });

  it('alan adlarını harf duyarsız okur ve metin sonucu sayıya çevirir', () => {
    expect(parseLoginSendResponse({ sonuc: '-1', sunucucevap: 'bulunamadı' })).toEqual({
      sonuc: -1,
      sunucuCevap: 'bulunamadı',
    });
  });

  it('boş yanıtta başarısız sonuç döner', () => {
    expect(parseLoginSendResponse([])).toEqual({ sonuc: -1, sunucuCevap: '' });
    expect(parseLoginSendResponse(null)).toEqual({ sonuc: -1, sunucuCevap: '' });
  });
});

describe('summarizeNames', () => {
  it('sınırın altındaysa hepsini gösterir', () => {
    expect(summarizeNames(['A', 'B'])).toEqual({ shown: 'A, B', rest: 0 });
  });

  it('sınırı aşan kısmı sayı olarak döner', () => {
    expect(summarizeNames(['A', 'B', 'C', 'D'], 2)).toEqual({ shown: 'A, B', rest: 2 });
  });
});
