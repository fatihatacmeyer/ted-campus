import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ProxyListComponent } from './proxy-list';
import { ProxyService } from '../../services/proxy.service';
import { GuardianProxy, ProxyApprovalStatus } from '../../../../core/models/proxy.model';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('ProxyListComponent', () => {
  let component: ProxyListComponent;
  let fixture: ComponentFixture<ProxyListComponent>;
  let proxyService: { getProxies: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    proxyService = { getProxies: vi.fn(() => of([] as GuardianProxy[])) };

    await TestBed.configureTestingModule({
      imports: [ProxyListComponent],
      providers: [...provideAppTesting(), { provide: ProxyService, useValue: proxyService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProxyListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('açılışta vekil listesini yükler', () => {
    expect(proxyService.getProxies).toHaveBeenCalled();
  });

  it('sekme değişimi listeyi yeni durumla yeniler', () => {
    proxyService.getProxies.mockClear();
    component.onTabChange(ProxyApprovalStatus.Approved);
    expect(proxyService.getProxies).toHaveBeenCalledWith(ProxyApprovalStatus.Approved);
  });
});
