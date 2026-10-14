import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { PersonListCardComponent, PersonListItem } from './person-list-card';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('PersonListCardComponent', () => {
  let fixture: ComponentFixture<PersonListCardComponent>;

  const person = (i: number, overrides: Partial<PersonListItem> = {}): PersonListItem => ({
    fullName: `Öğrenci ${i}`,
    className: '5-A',
    schoolName: 'Merkez',
    ...overrides,
  });

  const setup = (people: PersonListItem[], kind: 'early' | 'late' | 'absent' = 'absent') => {
    fixture = TestBed.createComponent(PersonListCardComponent);
    fixture.componentRef.setInput('people', people);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('titleKey', 'DASHBOARD.ABSENTEES');
    fixture.componentRef.setInput('emptyKey', 'DASHBOARD.NO_ABSENTEES');
    fixture.componentRef.setInput('icon', 'person_off');
    fixture.componentRef.setInput('iconCls', 'icon-slate');
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      search: { set(v: string): void };
      dialogVisible: () => boolean;
    };
  };

  const rows = (): number => fixture.nativeElement.querySelectorAll('.person-row').length;
  const dialogs = (): number => fixture.nativeElement.querySelectorAll('.p-dialog').length;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonListCardComponent],
      providers: [...provideAppTesting()],
    }).compileComponents();
  });

  afterEach(() => fixture.destroy());

  it('kişi yoksa boş durum gösterir', () => {
    setup([]);
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    expect(rows()).toBe(0);
  });

  it('en fazla 5 satır önizler ve kalan sayıyı gösterir', () => {
    setup(Array.from({ length: 8 }, (_, i) => person(i + 1)));
    expect(rows()).toBe(5);
    expect(fixture.nativeElement.querySelector('.show-more-btn')?.textContent).toContain('+3');
  });

  it('arama isim, sınıf ve okul alanlarında çalışır', () => {
    const card = setup([
      person(1),
      person(2, { fullName: 'İlkay Yılmaz' }),
      person(3, { className: '9-C' }),
    ]);
    card.search.set('ilkay');
    fixture.detectChanges();
    expect(rows()).toBe(1);

    card.search.set('9-c');
    fixture.detectChanges();
    expect(rows()).toBe(1);
  });

  it('erken çıkan türünde çıkış saati ve beklenen saat gösterilir', () => {
    setup([person(1, { exitTime: '2026-10-14T10:05:00', expectedExitTime: '15:00' })], 'early');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('10:05:00');
    expect(text).toContain('15:00');
  });

  it('tam ekran butonu tüm listeyi diyalogda açar', async () => {
    const card = setup(Array.from({ length: 8 }, (_, i) => person(i + 1)));
    expect(dialogs()).toBe(0);

    fixture.nativeElement.querySelector('.detail-card-header button').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(card.dialogVisible()).toBe(true);
    await vi.waitFor(() => expect(dialogs()).toBe(1));
    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelectorAll('.p-dialog .person-row')).toHaveLength(8),
    );
  });
});
