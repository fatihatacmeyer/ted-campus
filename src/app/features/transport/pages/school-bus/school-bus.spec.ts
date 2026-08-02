import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolBusComponent } from './school-bus';

describe('SchoolBus', () => {
  let component: SchoolBusComponent;
  let fixture: ComponentFixture<SchoolBusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolBusComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SchoolBusComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
