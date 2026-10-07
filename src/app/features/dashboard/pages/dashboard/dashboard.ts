import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  Observable,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth.service';
import {
  DashboardService,
  PersonType,
  DashboardCampusStats,
  EarlyLeaver,
  LateArrival,
  Absentee,
  AccessTransaction,
  InsidePerson,
  KvkkStats,
} from '../../services/dashboard.service';

interface InsideDialogState {
  type: PersonType | null;
  persons: InsidePerson[];
  loading: boolean;
  error: boolean;
}

/** Özet kartlarındaki listelerde gösterilecek maksimum satır sayısı. */
const PREVIEW_LIMIT = 5;
/** Son hareketler yenileme aralığı (ms). */
const TRANSACTION_POLL_MS = 1500;
const TRANSACTION_LIMIT_DEFAULT = 10;
const TRANSACTION_LIMIT_FULL = 100;
/** Son hareketlerde arama kutusu için yazma sonrası bekleme (ms). */
const TRANSACTION_SEARCH_DEBOUNCE_MS = 300;

const EMPTY_STATS: DashboardCampusStats = {
  studentCount: 0,
  parentCount: 0,
  totalRegisteredCount: 0,
  studentInsideCount: 0,
  parentInsideCount: 0,
  totalInsideCount: 0,
};

const EMPTY_KVKK: KvkkStats = {
  studentApproved: 0,
  parentApproved: 0,
  proxyApproved: 0,
  totalApproved: 0,
};

/** Onay oranı (%): kayıtlı yoksa 0; 100'ü aşmaz. */
const percentOf = (approved: number, registered: number): number =>
  registered > 0 ? Math.min(100, Math.round((approved / registered) * 100)) : 0;

const INITIAL_INSIDE_DIALOG: InsideDialogState = {
  type: null,
  persons: [],
  loading: false,
  error: false,
};

const toLowerTr = (value: string | null | undefined): string =>
  (value ?? '').toLocaleLowerCase('tr-TR');

/** İsim / sınıf / okul alanlarında (Türkçe duyarlı) arama yapar. */
const filterPeople = <T extends { fullName: string; className: string; schoolName: string }>(
  list: T[],
  term: string,
): T[] => {
  const q = toLowerTr(term.trim());
  if (!q) return list;
  return list.filter(
    (p) =>
      toLowerTr(p.fullName).includes(q) ||
      toLowerTr(p.className).includes(q) ||
      toLowerTr(p.schoolName).includes(q),
  );
};

@Component({
  selector: 'app-dashboard',
  imports: [
    ButtonModule,
    ProgressSpinnerModule,
    DialogModule,
    TooltipModule,
    InputTextModule,
    DatePipe,
    NgTemplateOutlet,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

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
  /**
   * KVKK onay sayıları (sp_KvkkOnayCampus_s). Bilinçli olarak `resources`
   * dışında: bu kaynak hata verirse yalnızca KVKK şeridi hata gösterir,
   * tüm pano hata ekranına düşmez.
   */
  private readonly kvkkResource = this.createResource(
    () => this.dashboardService.getKvkkStats(),
    EMPTY_KVKK,
  );
  private readonly resources = [
    this.statsResource,
    this.earlyLeaversResource,
    this.lateArrivalsResource,
    this.absenteesResource,
  ];

  readonly stats = this.statsResource.value;
  readonly earlyLeavers = this.earlyLeaversResource.value;
  readonly lateArrivals = this.lateArrivalsResource.value;
  readonly absentees = this.absenteesResource.value;

  readonly kvkk = this.kvkkResource.value;
  readonly kvkkLoading = this.kvkkResource.isLoading;
  readonly kvkkError = computed(() => !!this.kvkkResource.error());
  readonly kvkkStudentPercent = computed(() =>
    percentOf(this.kvkk().studentApproved, this.stats().studentCount),
  );
  readonly kvkkParentPercent = computed(() =>
    percentOf(this.kvkk().parentApproved, this.stats().parentCount),
  );

  readonly isLoading = computed(() => this.resources.some((r) => r.isLoading()));
  readonly errorMessage = computed(() =>
    this.resources.some((r) => r.error()) ? 'DASHBOARD.LOAD_ERROR' : '',
  );
  readonly transactions = signal<AccessTransaction[]>([]);

  /** Kart önizlemeleri: şablonda her değişiklik denetiminde slice yapmamak için. */
  /** Kart (ve dialog) içi arama metinleri: isim / sınıf / okul. */
  readonly earlySearch = signal('');
  readonly lateSearch = signal('');
  readonly absentSearch = signal('');

  readonly filteredEarlyLeavers = computed(() =>
    filterPeople(this.earlyLeavers(), this.earlySearch()),
  );
  readonly filteredLateArrivals = computed(() =>
    filterPeople(this.lateArrivals(), this.lateSearch()),
  );
  readonly filteredAbsentees = computed(() => filterPeople(this.absentees(), this.absentSearch()));

  readonly earlyLeaversPreview = computed(() => this.filteredEarlyLeavers().slice(0, PREVIEW_LIMIT));
  readonly latePreview = computed(() => this.filteredLateArrivals().slice(0, PREVIEW_LIMIT));
  readonly absenteesPreview = computed(() => this.filteredAbsentees().slice(0, PREVIEW_LIMIT));
  readonly earlyLeaversExtra = computed(() =>
    Math.max(0, this.filteredEarlyLeavers().length - PREVIEW_LIMIT),
  );
  readonly lateExtra = computed(() => Math.max(0, this.filteredLateArrivals().length - PREVIEW_LIMIT));
  readonly absenteesExtra = computed(() =>
    Math.max(0, this.filteredAbsentees().length - PREVIEW_LIMIT),
  );

  readonly setEarlySearch = (v: string) => this.earlySearch.set(v);
  readonly setLateSearch = (v: string) => this.lateSearch.set(v);
  readonly setAbsentSearch = (v: string) => this.absentSearch.set(v);

  /** Arama kutusundaki metin (anlık) ve backend'e uygulanmış metin (debounce sonrası). */
  readonly txnSearch = signal('');
  readonly appliedTxnSearch = signal('');
  readonly showAllTransactions = signal(false);
  readonly transactionCount = computed(() =>
    this.showAllTransactions() ? TRANSACTION_LIMIT_FULL : TRANSACTION_LIMIT_DEFAULT,
  );

  /** Oturum başına bir kez hesaplanan değerler */
  readonly greeting = this.buildGreeting();
  readonly userName = signal('');

  /* ── Dialog states ─────────────────────────────────────── */
  readonly txnDialogVisible = signal(false);
  readonly earlyLeaverDialogVisible = signal(false);
  readonly lateDialogVisible = signal(false);
  readonly absentDialogVisible = signal(false);

  /** "O an okulda olan" kişi listesi modalı (sp_DashboardKisilerCampus_s). */
  readonly insideDialogVisible = signal(false);
  readonly insideDialog = signal<InsideDialogState>(INITIAL_INSIDE_DIALOG);
  /** Kişi listesi modalındaki arama metni (isim / sınıf / okul / sicil). */
  readonly insideSearch = signal('');

  /** Arama metnine göre filtrelenmiş kişi listesi (isim, sınıf, okul, sicil). */
  readonly filteredInsidePersons = computed(() => {
    const q = toLowerTr(this.insideSearch().trim());
    const persons = this.insideDialog().persons;
    if (!q) return persons;
    return persons.filter(
      (p) =>
        toLowerTr(p.fullName).includes(q) ||
        toLowerTr(p.schoolName).includes(q) ||
        toLowerTr(p.className).includes(q) ||
        toLowerTr(p.registryNo).includes(q),
    );
  });

  /** Yeniden başlatılan (örn. "Tekrar dene") son hareket yoklama akışı tetikleyicisi. */
  private readonly refreshTransactions$ = new Subject<void>();
  private readonly txnSearchInput$ = new Subject<string>();
  private insideRequest?: Subscription;

  /* ── Lifecycle ─────────────────────────────────────────── */
  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    this.userName.set(
      user?.fullname || user?.loginname || this.translate.instant('DASHBOARD.USER'),
    );

    this.initTransactionStream();
    this.initTransactionSearch();
  }

  /* ── Data ──────────────────────────────────────────────── */
  /** Kart verilerini yeniden yükler ("Tekrar dene"). */
  fetchData(): void {
    this.resources.forEach((r) => r.reload());
    this.kvkkResource.reload();
  }

  reloadKvkk(): void {
    this.kvkkResource.reload();
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

  /**
   * Son hareketleri periyodik yoklar. Sekme arka plandayken istek atılmaz,
   * hata oluşursa yoklama durmaz, veri değişmediyse yeniden render edilmez.
   */
  private initTransactionStream(): void {
    this.refreshTransactions$
      .pipe(
        startWith(undefined),
        switchMap(() => timer(0, TRANSACTION_POLL_MS)),
        filter(() => !this.document.hidden),
        switchMap(() =>
          this.dashboardService.getRecentTransactions(this.transactionLimit(), this.appliedTxnSearch()).pipe(
            catchError((err) => {
              console.error('Son hareketler alınamadı:', err);
              return EMPTY;
            }),
          ),
        ),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.transactions.set(data));
  }

  /** Arama metni durulunca uygulanır ve yoklama akışı anında yeniden başlatılır. */
  private initTransactionSearch(): void {
    this.txnSearchInput$
      .pipe(
        debounceTime(TRANSACTION_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((term) => {
        this.appliedTxnSearch.set(term);
        this.refreshTransactions$.next();
      });
  }

  onTxnSearch(value: string): void {
    this.txnSearch.set(value);
    this.txnSearchInput$.next(value.trim());
  }

  private transactionLimit(): number {
    return this.showAllTransactions() || this.txnDialogVisible()
      ? TRANSACTION_LIMIT_FULL
      : TRANSACTION_LIMIT_DEFAULT;
  }

  /* ── UI actions ────────────────────────────────────────── */
  /** Tam ekran işlemler tablosu dialog'unu açar ve 100 limitli veriyi anında çeker. */
  openTxnDialog(): void {
    this.txnDialogVisible.set(true);
    this.refreshTransactions$.next();
  }

  toggleAllTransactions(): void {
    this.showAllTransactions.update((v) => !v);
    this.refreshTransactions$.next();
  }

  /**
   * Kartlara tıklanınca "o an okulda olan" kişi listesini modalda gösterir.
   * sp_DashboardKisilerCampus_s çağrılır (SadeceOkulda=1 sabit — sadece
   * içeridekiler). type: 'STUDENT' | 'PARENT' | null (ikisi birden).
   */
  openInsideDialog(type: PersonType | null): void {
    this.insideRequest?.unsubscribe();
    this.insideSearch.set('');
    this.insideDialog.set({ ...INITIAL_INSIDE_DIALOG, type, loading: true });
    this.insideDialogVisible.set(true);

    this.insideRequest = this.dashboardService
      .getInsidePersons(type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (persons) => this.insideDialog.update((s) => ({ ...s, persons, loading: false })),
        error: (err) => {
          console.error('Okulda olan kişiler alınamadı:', err);
          this.insideDialog.update((s) => ({ ...s, loading: false, error: true }));
        },
      });
  }

  /** Detay kartı başlığındaki "genişlet" butonları için sabit referanslar. */
  readonly openEarlyLeaverDialog = () => this.earlyLeaverDialogVisible.set(true);
  readonly openLateDialog = () => this.lateDialogVisible.set(true);
  readonly openAbsentDialog = () => this.absentDialogVisible.set(true);

  /** Kişi listesi satırı için "Sınıf · Okul" meta metni (null alanları atlar). */
  directionLabel(direction: string | null): string {
    if (!direction) return 'DASHBOARD.DIRECTION_UNKNOWN';
    return direction === 'in' ? 'DASHBOARD.DIRECTION_IN' : 'DASHBOARD.DIRECTION_OUT';
  }

  resultLabel(result: string): string {
    switch (result) {
      case 'success':
        return 'DASHBOARD.RESULT_SUCCESS';
      case 'service':
        return 'DASHBOARD.RESULT_SERVICE';
      default:
        return 'DASHBOARD.RESULT_FAILED';
    }
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'DASHBOARD.GREETING_MORNING';
    if (hour < 18) return 'DASHBOARD.GREETING_AFTERNOON';
    return 'DASHBOARD.GREETING_EVENING';
  }
}
