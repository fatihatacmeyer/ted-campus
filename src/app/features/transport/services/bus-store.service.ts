import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NotificationService } from '../../../core/services/notification.service';
import { Person, UserDef } from '../../../core/models/person.model';
import { PersonService } from '../../persons/services/person.service';
import { Bus } from '../models/school-bus.model';
import { SchoolBusService } from './school-bus.service';

/**
 * Servis sayfasındaki sekmelerin ortak kullandığı listeler (araçlar, öğrenciler, yetkili sicilleri).
 * Sayfa bileşeninde sağlandığı için sayfadan çıkınca state de yok olur.
 */
@Injectable()
export class BusStoreService {
  private readonly busService = inject(SchoolBusService);
  private readonly personService = inject(PersonService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly buses = signal<Bus[]>([]);
  readonly students = signal<Person[]>([]);
  /** Servise atanabilecek yetkili sicilleri (Atamalar sekmesi seçenekleri). */
  readonly authorities = signal<Person[]>([]);

  private busesLoaded = false;

  /** Araç listesini her zaman yeniden okur (araç/atama değişikliklerinden sonra). */
  loadBuses(): void {
    this.busService
      .getBuses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (busesData) => {
          this.buses.set(busesData);
          this.busesLoaded = true;
        },
        error: () => this.notification.error('SCHOOL_BUS.MSG_BUSES_ERROR'),
      });
  }

  /** Araçlar daha önce yüklenmediyse yükler; sonraki değişiklikler zaten `loadBuses` ile yenilenir. */
  ensureBuses(): void {
    if (!this.busesLoaded) this.loadBuses();
  }

  ensureStudents(): void {
    if (this.students().length > 0) return;
    this.personService
      .getPersonListCampus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (people) => this.students.set(people.filter((p) => p.userdef === UserDef.Ogrenci)),
        error: () => this.notification.error('SCHOOL_BUS.MSG_STUDENTS_ERROR'),
      });
  }

  ensureAuthorities(): void {
    if (this.authorities().length > 0) return;
    this.personService
      .getPersonListCampus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (people) =>
          this.authorities.set(people.filter((p) => p.userdef === UserDef.Authority)),
        error: () => this.notification.error('SCHOOL_BUS.MSG_AUTHORITIES_ERROR'),
      });
  }

  /** Yetkili eklendi/güncellendi/çıkış verildi: atama seçenekleri bir sonraki açılışta yeniden yüklensin. */
  invalidateAuthorities(): void {
    this.authorities.set([]);
  }
}
