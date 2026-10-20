import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { BulkImportComponent } from './bulk-import';
import { BulkImportService } from '../../services/bulk-import.service';
import { ImportRow } from '../../models/bulk-import.model';
import { provideAppTesting } from '../../../../testing/test-providers';

function row(partial: Partial<ImportRow> & { rowNo: number }): ImportRow {
  return {
    ad: 'Ali',
    soyad: 'Kaya',
    key: '12345678901',
    payload: null,
    status: 'ready',
    issues: [],
    existingId: null,
    relationStudentIds: [],
    alreadyLinked: 0,
    ...partial,
  };
}

describe('BulkImportComponent önizleme tablosu', () => {
  let fixture: ComponentFixture<BulkImportComponent>;
  let component: BulkImportComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkImportComponent],
      providers: [...provideAppTesting(), { provide: BulkImportService, useValue: { importRows: vi.fn() } }],
    }).compileComponents();
    fixture = TestBed.createComponent(BulkImportComponent);
    fixture.componentRef.setInput('kind', 'student');
    component = fixture.componentInstance;
  });

  const bodyRows = () =>
    Array.from(fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>);

  function showPreview(rows: ImportRow[]): void {
    component.rows.set(rows);
    component.step.set('preview');
    fixture.detectChanges();
  }

  it('tek satırlık dosyada satırı tabloda gösterir', async () => {
    showPreview([row({ rowNo: 2 })]);
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Ali Kaya');
  });

  it('güncellenecek ve mevcut satırları gösterir', async () => {
    showPreview([
      row({
        rowNo: 2,
        status: 'update',
        changes: [{ field: 'Sınıf / Şube', from: '5-A', to: '5-B' }],
        issues: [{ key: 'BULK_IMPORT.ISSUE_WILL_UPDATE', params: { fields: 'Sınıf / Şube' } }],
      }),
      row({ rowNo: 3, status: 'exists', issues: [{ key: 'BULK_IMPORT.ISSUE_EXISTS' }] }),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = bodyRows();
    expect(rows).toHaveLength(2);
  });

  it('önceki dosyada ileri sayfadayken tek satırlık yeni dosyada satırı gösterir', async () => {
    const { Table } = await import('primeng/table');
    showPreview(Array.from({ length: 60 }, (_, i) => row({ rowNo: i + 2 })));
    await fixture.whenStable();
    const table = fixture.debugElement.query((de) => de.componentInstance instanceof Table)
      .componentInstance as InstanceType<typeof Table>;
    table.first = 50; // kullanıcı 3. sayfaya geçmiş
    fixture.detectChanges();

    component.reset();
    fixture.detectChanges();
    showPreview([row({ rowNo: 2, ad: 'Tek' })]);
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = bodyRows();
    expect(rows[0].textContent).toContain('Tek');
  });

  it('ileri sayfadayken filtre tek satıra düşerse satırı gösterir', async () => {
    const { Table } = await import('primeng/table');
    showPreview([
      ...Array.from({ length: 59 }, (_, i) => row({ rowNo: i + 2 })),
      row({ rowNo: 61, ad: 'Hatalı', status: 'error', issues: [{ key: 'BULK_IMPORT.ISSUE_INVALID_TC' }] }),
    ]);
    await fixture.whenStable();
    const table = fixture.debugElement.query((de) => de.componentInstance instanceof Table)
      .componentInstance as InstanceType<typeof Table>;
    table.first = 50;
    fixture.detectChanges();

    component.setStatusFilter('error');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = bodyRows();
    expect(rows[0].textContent).toContain('Hatalı');
  });
});
