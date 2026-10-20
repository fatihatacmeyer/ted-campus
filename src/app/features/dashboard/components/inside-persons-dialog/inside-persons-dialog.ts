import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { Subscription } from 'rxjs';

import { DashboardService, InsidePerson, PersonType } from '../../services/dashboard.service';
import { toLowerTr, uniqueSorted } from '../../utils/dashboard.utils';

interface InsideDialogState {
  type: PersonType | null;
  persons: InsidePerson[];
  loading: boolean;
  error: boolean;
}

const INITIAL_STATE: InsideDialogState = {
  type: null,
  persons: [],
  loading: false,
  error: false,
};

/**
 * "O an okulda olan" kişi listesi diyaloğu (sp_DashboardKisilerCampus_s).
 * Üst bileşen `open(type)` ile açar; yükleme, arama ve filtreler burada yönetilir.
 */
@Component({
  selector: 'app-inside-persons-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    DialogModule,
    InputTextModule,
    ProgressSpinnerModule,
    SelectModule,
  ],
  templateUrl: './inside-persons-dialog.html',
  styleUrl: './inside-persons-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsidePersonsDialogComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visible = signal(false);
  protected readonly state = signal<InsideDialogState>(INITIAL_STATE);
  private request?: Subscription;

  /** Arama metni (isim / sınıf / okul / sicil). */
  protected readonly insideSearch = signal('');

  /** Okul / sınıf / tür / öğrenci filtreleri ('' = hepsi). */
  protected readonly insideSchoolFilter = signal('');
  protected readonly insideClassFilter = signal('');
  protected readonly insideTypeFilter = signal<'' | PersonType>('');
  protected readonly insideStudentFilter = signal('');
  /** Tür seçenekleri: değer olarak PersonType, etiket olarak çeviri anahtarı. */
  protected readonly insideTypeOptions = [
    { label: 'USERDEF.STUDENT', value: 'STUDENT' },
    { label: 'USERDEF.PARENT', value: 'PARENT' },
  ];

  /**
   * Karşılıklı daralan (faceted) filtre seçenekleri: her dropdown, KENDİ filtresi
   * hariç diğer tüm filtrelere ve aramaya uyan kişilerden üretilir. Böylece
   * hiçbir filtre kendiliğinden sıfırlanmaz ve boş sonuç veren kombinasyon oluşmaz.
   */
  protected readonly insideSchoolOptions = computed(() =>
    uniqueSorted(this.personsMatching('school').map((p) => p.schoolName)),
  );
  protected readonly insideClassOptions = computed(() =>
    uniqueSorted(this.personsMatching('class').map((p) => p.className)),
  );
  /** Veli satırlarındaki öğrenciler için filtre seçenekleri ("Ad Soyad (Sınıf)"). */
  protected readonly insideStudentOptions = computed(() =>
    uniqueSorted(
      this.personsMatching('student').flatMap((p) => (p.students ? p.students.split(', ') : [])),
    ),
  );

  /** Öğrenci kolonu yalnızca veli içeren görünümde anlamlıdır. */
  protected readonly showInsideStudentsCol = computed(
    () => this.state().type !== 'STUDENT' && this.insideTypeFilter() !== 'STUDENT',
  );

  /** Arama metni ve tüm filtrelere göre daraltılmış kişi listesi. */
  protected readonly filteredInsidePersons = computed(() => this.personsMatching());

  /** `skip` verilen filtre hariç, arama ve diğer filtrelere uyan kişiler. */
  private personsMatching(skip?: 'school' | 'class' | 'student'): InsidePerson[] {
    const q = toLowerTr(this.insideSearch().trim());
    const school = skip === 'school' ? '' : this.insideSchoolFilter();
    const cls = skip === 'class' ? '' : this.insideClassFilter();
    // Öğrenci filtresi gizliyken (yalnızca öğrenci görünümü) uygulanmamalı.
    const student =
      skip === 'student' || !this.showInsideStudentsCol() ? '' : this.insideStudentFilter();
    const type = this.insideTypeFilter();
    return this.state().persons.filter(
      (p) =>
        (!school || p.schoolName === school) &&
        (!student || (p.students ?? '').split(', ').includes(student)) &&
        (!cls || p.className === cls) &&
        (!type || p.type === type) &&
        (!q ||
          toLowerTr(p.fullName).includes(q) ||
          toLowerTr(p.schoolName).includes(q) ||
          toLowerTr(p.className).includes(q) ||
          toLowerTr(p.registryNo).includes(q) ||
          toLowerTr(p.students).includes(q)),
    );
  }

  /**
   * Diyaloğu açıp "o an okulda olan" kişileri yükler (SadeceOkulda=1 sabit).
   * type: 'STUDENT' | 'PARENT' | null (ikisi birden).
   */
  open(type: PersonType | null): void {
    this.request?.unsubscribe();
    this.insideSearch.set('');
    this.insideSchoolFilter.set('');
    this.insideClassFilter.set('');
    this.insideTypeFilter.set('');
    this.insideStudentFilter.set('');
    this.state.set({ ...INITIAL_STATE, type, loading: true });
    this.visible.set(true);

    this.request = this.dashboardService
      .getInsidePersons(type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (persons) => this.state.update((s) => ({ ...s, persons, loading: false })),
        error: (err) => {
          console.error('Okulda olan kişiler alınamadı:', err);
          this.state.update((s) => ({ ...s, loading: false, error: true }));
        },
      });
  }
}
