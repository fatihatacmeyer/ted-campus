import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionsTableComponent } from './transactions-table';
import { AccessTransaction } from '../../services/dashboard.service';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('TransactionsTableComponent', () => {
  let fixture: ComponentFixture<TransactionsTableComponent>;

  const txn = (overrides: Partial<AccessTransaction> = {}): AccessTransaction => ({
    id: 1,
    personName: 'Ali Veli',
    registryNo: '100',
    userdef: 11,
    badgeClass: 'badge-student',
    badgeLabel: 'USERDEF.STUDENT',
    cardId: '0001',
    time: '2026-10-14 08:00:00',
    timestamp: new Date(2026, 9, 14, 8, 0).getTime(),
    className: '5-A',
    campusName: 'Merkez',
    direction: 'in',
    device: 'Turnike 1',
    result: 'success',
    isProxy: false,
    rawDirectionText: 'Giriş',
    rawResultText: 'Başarılı',
    ...overrides,
  });

  const rowsInDom = (): number =>
    fixture.nativeElement.querySelectorAll('tbody tr:not(.txn-empty)').length;

  const setup = (
    rows: AccessTransaction[],
    inputs: Partial<{ filterable: boolean; translated: boolean; searching: boolean }> = {},
  ) => {
    fixture = TestBed.createComponent(TransactionsTableComponent);
    fixture.componentRef.setInput('rows', rows);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      filters: { set(f: unknown): void; (): Record<string, unknown> };
      setFilter(key: string, value: unknown): void;
      clearFilters(): void;
    };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionsTableComponent],
      providers: [...provideAppTesting()],
    }).compileComponents();
  });

  it('filtrelenemez modda tüm satırları gösterir ve filtre satırı çıkmaz', () => {
    setup([txn({ id: 1 }), txn({ id: 2, className: '6-B' })]);
    expect(rowsInDom()).toBe(2);
    expect(fixture.nativeElement.querySelector('.txn-filter-row')).toBeNull();
  });

  it('filtrelenebilir modda sınıf filtresi satırları daraltır', () => {
    const table = setup([txn({ id: 1 }), txn({ id: 2, className: '6-B' })], { filterable: true });
    expect(fixture.nativeElement.querySelector('.txn-filter-row')).not.toBeNull();

    table.setFilter('className', '6-B');
    fixture.detectChanges();
    expect(rowsInDom()).toBe(1);

    table.clearFilters();
    fixture.detectChanges();
    expect(rowsInDom()).toBe(2);
  });

  it('sicil filtresi Türkçe duyarlı ve kısmi eşleşir', () => {
    const table = setup(
      [txn({ id: 1, registryNo: 'ABC100' }), txn({ id: 2, registryNo: 'XYZ200' })],
      {
        filterable: true,
      },
    );
    table.setFilter('sicil', 'abc');
    fixture.detectChanges();
    expect(rowsInDom()).toBe(1);
  });

  it('tarih aralığı bitiş gününü dahil eder', () => {
    const day = (d: number, h: number) => new Date(2026, 9, d, h, 0).getTime();
    const table = setup(
      [
        txn({ id: 1, timestamp: day(13, 23) }),
        txn({ id: 2, timestamp: day(14, 23) }),
        txn({ id: 3, timestamp: day(15, 1) }),
      ],
      { filterable: true },
    );
    table.setFilter('range', [new Date(2026, 9, 14), new Date(2026, 9, 14)]);
    fixture.detectChanges();
    expect(rowsInDom()).toBe(1);
  });

  it('satır yokken arama durumuna göre boş mesaj gösterir', () => {
    setup([], { searching: true });
    expect(fixture.nativeElement.querySelector('.txn-empty')?.textContent).toContain(
      'DASHBOARD.NO_SEARCH_RESULT',
    );
  });
});
