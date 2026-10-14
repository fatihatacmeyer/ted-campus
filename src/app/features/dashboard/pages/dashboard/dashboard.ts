import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth.service';
import {
  DashboardService,
  PersonType,
  DashboardCampusStats,
  EarlyLeaver,
  LateArrival,
  Absentee,
} from '../../services/dashboard.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';
import { InsidePersonsDialogComponent } from '../../components/inside-persons-dialog/inside-persons-dialog';
import { KvkkCardComponent } from '../../components/kvkk-card/kvkk-card';
import { PersonListCardComponent } from '../../components/person-list-card/person-list-card';
import { StatCardComponent } from '../../components/stat-card/stat-card';
import { TransactionsCardComponent } from '../../components/transactions-card/transactions-card';

const EMPTY_STATS: DashboardCampusStats = {
  studentCount: 0,
  parentCount: 0,
  totalRegisteredCount: 0,
  studentInsideCount: 0,
  parentInsideCount: 0,
  totalInsideCount: 0,
};

/**
 * Ana sayfa kabuğu: karşılama başlığı, özet sayılar ve erken çıkan / geç kalan / gelmeyen
 * listeleri. KVKK şeridi, son hareketler ve "okulda olanlar" diyaloğu kendi bileşenlerinde yaşar.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    PageHeaderComponent,
    ButtonModule,
    ProgressSpinnerModule,
    TranslatePipe,
    StatCardComponent,
    KvkkCardComponent,
    PersonListCardComponent,
    TransactionsCardComponent,
    InsidePersonsDialogComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);

  private readonly insideDialog = viewChild.required(InsidePersonsDialogComponent);

  /* ── State ─────────────────────────────────────────────── */
  /** Özet sayılar (sp_DashboardCampus_s): Kayıtlı / Okulda */
  private readonly statsResource = this.createResource(
    () => this.dashboardService.getDashboardStats(),
    EMPTY_STATS,
  );
  private readonly earlyLeaversResource = this.createResource(
    () => this.dashboardService.getEarlyLeavers(),
    [] as EarlyLeaver[],
  );
  private readonly lateArrivalsResource = this.createResource(
    () => this.dashboardService.getLateArrivals(),
    [] as LateArrival[],
  );
  private readonly absenteesResource = this.createResource(
    () => this.dashboardService.getAbsentees(),
    [] as Absentee[],
  );
  private readonly resources = [
    this.statsResource,
    this.earlyLeaversResource,
    this.lateArrivalsResource,
    this.absenteesResource,
  ];

  protected readonly stats = this.statsResource.value;
  protected readonly earlyLeavers = this.earlyLeaversResource.value;
  protected readonly lateArrivals = this.lateArrivalsResource.value;
  protected readonly absentees = this.absenteesResource.value;

  protected readonly isLoading = computed(() => this.resources.some((r) => r.isLoading()));
  protected readonly errorMessage = computed(() =>
    this.resources.some((r) => r.error()) ? 'DASHBOARD.LOAD_ERROR' : '',
  );

  /** Oturum başına bir kez hesaplanan değerler */
  protected readonly greeting = this.buildGreeting();
  protected readonly userName = signal('');

  /** Banner'da gösterilen uzun tarih (dil değişince güncellenir). */
  protected readonly todayLabel = computed(() =>
    new Date().toLocaleDateString(this.translate.currentLang() === 'en' ? 'en-GB' : 'tr-TR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  /* ── Lifecycle ─────────────────────────────────────────── */
  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    this.userName.set(
      user?.fullname || user?.loginname || this.translate.instant('DASHBOARD.USER'),
    );
  }

  /* ── Data ──────────────────────────────────────────────── */
  /** Kart verilerini yeniden yükler ("Tekrar dene"). */
  protected fetchData(): void {
    this.resources.forEach((r) => r.reload());
  }

  private createResource<T>(request: () => Observable<T>, defaultValue: T) {
    return rxResource<T, void>({
      stream: () =>
        request().pipe(
          tap({ error: (err) => console.error('Dashboard veri yükleme hatası:', err) }),
        ),
      defaultValue,
    });
  }

  /* ── UI actions ────────────────────────────────────────── */
  /**
   * Özet kartına tıklanınca "o an okulda olan" kişi listesini diyalogda gösterir.
   * type: 'STUDENT' | 'PARENT' | null (ikisi birden).
   */
  protected openInside(type: PersonType | null): void {
    this.insideDialog().open(type);
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'DASHBOARD.GREETING_MORNING';
    if (hour < 18) return 'DASHBOARD.GREETING_AFTERNOON';
    return 'DASHBOARD.GREETING_EVENING';
  }
}
