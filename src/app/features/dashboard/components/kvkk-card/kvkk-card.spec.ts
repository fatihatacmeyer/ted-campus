import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { KvkkCardComponent } from './kvkk-card';
import { DashboardService, KvkkStats } from '../../services/dashboard.service';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('KvkkCardComponent', () => {
  let fixture: ComponentFixture<KvkkCardComponent>;

  const stats: KvkkStats = {
    studentApproved: 50,
    parentApproved: 30,
    proxyApproved: 4,
    serviceApproved: 2,
    totalApproved: 84,
  };

  const setup = async (getKvkkStats: () => unknown) => {
    await TestBed.configureTestingModule({
      imports: [KvkkCardComponent],
      providers: [
        ...provideAppTesting(),
        { provide: DashboardService, useValue: { getKvkkStats } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KvkkCardComponent);
    fixture.componentRef.setInput('studentCount', 100);
    fixture.componentRef.setInput('parentCount', 60);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => fixture.destroy());

  it('beş blok gösterir ve öğrenci/veli yüzdesini kayıtlıya göre hesaplar', async () => {
    await setup(() => of(stats));

    const blocks = fixture.nativeElement.querySelectorAll('.kvkk-block');
    expect(blocks).toHaveLength(5);
    expect(blocks[0].textContent).toContain('%50'); // 50/100
    expect(blocks[1].textContent).toContain('%50'); // 30/60
    // vekil / servis / toplam: oransız, ilerleme çubuğu yok
    expect(blocks[2].querySelector('.kvkk-bar')).toBeNull();
    expect(blocks[4].textContent).toContain('84');
  });

  it('kayıtlı sayısı 0 ise yüzde 0 olur (sıfıra bölme yok)', async () => {
    await setup(() => of(stats));
    fixture.componentRef.setInput('studentCount', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kvkk-block').textContent).toContain('%0');
  });

  it('hata durumunda yalnızca bu kart hata gösterir ve tekrar dene yeniden yükler', async () => {
    const getKvkkStats = vi.fn(() => throwError(() => new Error('boom')));
    await setup(getKvkkStats);

    expect(fixture.nativeElement.querySelector('.error-banner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.kvkk-grid')).toBeNull();

    const calls = getKvkkStats.mock.calls.length;
    fixture.nativeElement.querySelector('.error-banner button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getKvkkStats.mock.calls.length).toBeGreaterThan(calls);
  });
});
