import {
  buildClassGroups,
  compareClassNames,
  extractClassNames,
  matchesClassSelection,
  parseClassName,
} from './class-name.utils';

describe('class-name.utils', () => {
  it('parseClassName seviye ve şubeyi ayırır, ayraçları normalleştirir', () => {
    expect(parseClassName('5/A')).toEqual({ grade: 5, section: 'A', name: '5/A' });
    expect(parseClassName('10-b')).toEqual({ grade: 10, section: 'B', name: '10/B' });
    expect(parseClassName('ANA')).toEqual({ grade: null, section: '', name: 'ANA' });
    expect(parseClassName('LHZ/A').grade).toBeNull();
  });

  it('compareClassNames sayısal sıralar, seviyesizleri sona koyar', () => {
    const sorted = ['ANA', '10/A', '2/B', '2/A', '1/E'].sort(compareClassNames);
    expect(sorted).toEqual(['1/E', '2/A', '2/B', '10/A', 'ANA']);
  });

  it('extractClassNames parantez içindekileri çıkarır, parantez yoksa metnin kendisini döndürür', () => {
    expect(extractClassNames('Ayşe Yılmaz (5/A), Ali Yılmaz (7/B)')).toEqual(['5/A', '7/B']);
    expect(extractClassNames('6/C')).toEqual(['6/C']);
    expect(extractClassNames(null)).toEqual([]);
  });

  it('buildClassGroups seviye → şube ağacı üretir', () => {
    const groups = buildClassGroups(['5/B', '5/A', '10/A', 'ANA', '5/A']);
    expect(groups).toEqual([
      { grade: 5, key: '5', sections: ['A', 'B'] },
      { grade: 10, key: '10', sections: ['A'] },
      { grade: null, key: 'ANA', sections: [] },
    ]);
  });

  describe('matchesClassSelection', () => {
    const names = ['5/A', '7/B'];

    it('boş seçimde her satır geçer', () => {
      expect(matchesClassSelection(names, [])).toBe(true);
      expect(matchesClassSelection([], null)).toBe(true);
    });

    it('seviye token\'ı tüm şubelerle eşleşir; 15 ve 25 ile karışmaz', () => {
      expect(matchesClassSelection(['5/C'], ['5'])).toBe(true);
      expect(matchesClassSelection(['15/A', '25/B'], ['5'])).toBe(false);
    });

    it('şube token\'ı yalnızca o şubeyle eşleşir', () => {
      expect(matchesClassSelection(names, ['5/A'])).toBe(true);
      expect(matchesClassSelection(names, ['5/B'])).toBe(false);
    });

    it('karışık seçimde çocuklardan biri uyarsa satır geçer', () => {
      expect(matchesClassSelection(names, ['6', '7/B'])).toBe(true);
      expect(matchesClassSelection(names, ['6', '7/C'])).toBe(false);
    });

    it('seviyesiz sınıflar tam adla eşleşir', () => {
      expect(matchesClassSelection(['ANA'], ['ANA'])).toBe(true);
      expect(matchesClassSelection(['LHZ/A'], ['LHZ/A'])).toBe(true);
    });
  });
});
