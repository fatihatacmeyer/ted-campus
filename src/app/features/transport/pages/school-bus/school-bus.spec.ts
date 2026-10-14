import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolBusComponent } from './school-bus';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('SchoolBus', () => {
  let component: SchoolBusComponent;
  let fixture: ComponentFixture<SchoolBusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolBusComponent],
      providers: [...provideAppTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SchoolBusComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
