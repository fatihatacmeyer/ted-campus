import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { InsidePersonsDialogComponent } from './inside-persons-dialog';
import { DashboardService, InsidePerson } from '../../services/dashboard.service';
import { provideAppTesting } from '../../../../testing/test-providers';

/** Şablonun kullandığı protected üyelerin test görünümü. */
interface DialogInternals {
  insideSchoolFilter: WritableSignal<string>;
  insideClassFilter: WritableSignal<string>;
  insideStudentFilter: WritableSignal<string>;
  insideTypeFilter: WritableSignal<'' | 'STUDENT' | 'PARENT'>;
  insideSchoolOptions: Signal<string[]>;
  insideClassOptions: Signal<string[]>;
  filteredInsidePersons: Signal<InsidePerson[]>;
}

describe('InsidePersonsDialogComponent filtreleri', () => {
  let fixture: ComponentFixture<InsidePersonsDialogComponent>;
  let dialog: DialogInternals;

  const person = (id: number, schoolName: string, className: string): InsidePerson => ({
    id,
    fullName: `Kişi ${id}`,
    type: 'STUDENT',
    className,
    schoolName,
    registryNo: String(id),
    isInside: true,
    students: null,
  });

  beforeEach(async () => {
    const persons = [
      person(1, 'Merkez', '5-A'),
      person(2, 'Merkez', '6-B'),
      person(3, 'Kuzey', '5-A'),
      person(4, 'Kuzey', '7-C'),
    ];
    await TestBed.configureTestingModule({
      imports: [InsidePersonsDialogComponent],
      providers: [
        ...provideAppTesting(),
        { provide: DashboardService, useValue: { getInsidePersons: vi.fn(() => of(persons)) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InsidePersonsDialogComponent);
    fixture.componentInstance.open(null);
    dialog = fixture.componentInstance as unknown as DialogInternals;
  });

  afterEach(() => fixture.destroy());

  it('sınıf seçiliyken okul değiştirmek sınıf filtresini sıfırlamaz', () => {
    dialog.insideClassFilter.set('5-A');
    dialog.insideSchoolFilter.set('Kuzey');

    expect(dialog.insideClassFilter()).toBe('5-A');
    expect(dialog.filteredInsidePersons().map((p) => p.id)).toEqual([3]);
  });

  it('okul seçenekleri seçili sınıfa göre daralır', () => {
    dialog.insideClassFilter.set('6-B');

    expect(dialog.insideSchoolOptions()).toEqual(['Merkez']);
  });

  it('sınıf seçenekleri seçili okula göre daralır', () => {
    dialog.insideSchoolFilter.set('Kuzey');

    expect(dialog.insideClassOptions()).toEqual(['5-A', '7-C']);
  });

  it('öğrenci filtresi gizlendiğinde (tür=öğrenci) uygulanmaz', () => {
    dialog.insideStudentFilter.set('Yok Öğrenci (1-A)');
    expect(dialog.filteredInsidePersons()).toHaveLength(0);

    dialog.insideTypeFilter.set('STUDENT');

    expect(dialog.filteredInsidePersons()).toHaveLength(4);
  });

  it('seçili filtre kendi seçenek listesinde kalır', () => {
    dialog.insideSchoolFilter.set('Merkez');
    dialog.insideClassFilter.set('5-A');

    expect(dialog.insideSchoolOptions()).toEqual(['Kuzey', 'Merkez']);
    expect(dialog.insideClassOptions()).toEqual(['5-A', '6-B']);
  });
});
