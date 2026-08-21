import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProxyList } from './proxy-list';

describe('ProxyList', () => {
  let component: ProxyList;
  let fixture: ComponentFixture<ProxyList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProxyList],
    }).compileComponents();

    fixture = TestBed.createComponent(ProxyList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
