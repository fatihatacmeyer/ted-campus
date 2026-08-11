import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { ActivitiesComponent } from './activities-list';
import { APP_CONFIG, AppConfig } from '../../../../core/services/app-config.service';

describe('ActivitiesComponent', () => {
  let component: ActivitiesComponent;
  let fixture: ComponentFixture<ActivitiesComponent>;

  const mockConfig: AppConfig = {
    production: false,
    appVersion: 'test',
    USERDATA_KEY: 'test-key',
    isMockEnabled: false,
    isAuthEnabled: true,
    apiUrl: 'http://localhost:1323',
    reportBaseUrl: 'http://localhost:1323',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesComponent],
      providers: [
        provideHttpClient(),
        { provide: APP_CONFIG, useValue: mockConfig },
        MessageService,
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivitiesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
