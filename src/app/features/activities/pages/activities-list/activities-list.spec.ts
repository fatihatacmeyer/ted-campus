import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivitiesComponent } from './activities-list';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('ActivitiesComponent', () => {
  let component: ActivitiesComponent;
  let fixture: ComponentFixture<ActivitiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesComponent],
      providers: [...provideAppTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivitiesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
