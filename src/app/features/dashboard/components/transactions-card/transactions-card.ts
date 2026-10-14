import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  startWith,
  switchMap,
  timer,
} from 'rxjs';

import { AccessTransaction, DashboardService } from '../../services/dashboard.service';
import { SearchBoxComponent } from '../search-box/search-box';
import {
  EMPTY_TXN_FILTERS,
  TransactionsTableComponent,
  TxnFilters,
} from '../transactions-table/transactions-table';

/** Son hareketler yenileme aralığı (ms). */
const TRANSACTION_POLL_MS = 1500;
const TRANSACTION_LIMIT_DEFAULT = 10;
const TRANSACTION_LIMIT_FULL = 100;
/** Arama kutusu için yazma sonrası bekleme (ms). */
const TRANSACTION_SEARCH_DEBOUNCE_MS = 300;

/** Son hareketler kartı: periyodik yoklama, backend araması ve tam ekran filtreli diyalog. */
@Component({
  selector: 'app-transactions-card',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    DialogModule,
    TooltipModule,
    SearchBoxComponent,
    TransactionsTableComponent,
  ],
  templateUrl: './transactions-card.html',
  styleUrl: './transactions-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsCardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly transactions = signal<AccessTransaction[]>([]);

  /** Arama kutusundaki metin (anlık) ve backend'e uygulanmış metin (debounce sonrası). */
  protected readonly txnSearch = signal('');
  protected readonly appliedTxnSearch = signal('');
  protected readonly showAllTransactions = signal(false);
  protected readonly transactionCount = computed(() =>
    this.showAllTransactions() ? TRANSACTION_LIMIT_FULL : TRANSACTION_LIMIT_DEFAULT,
  );

  protected readonly dialogVisible = signal(false);
  /** Diyalog kapanıp açılınca filtreler korunur. */
  protected readonly filters = signal<TxnFilters>(EMPTY_TXN_FILTERS);

  /** Yoklama akışını anında yeniden başlatan tetikleyici (arama, limit değişimi, diyalog açılışı). */
  private readonly refresh$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  ngOnInit(): void {
    this.initTransactionStream();
    this.initTransactionSearch();
  }

  /**
   * Son hareketleri periyodik yoklar. Sekme arka plandayken istek atılmaz,
   * hata oluşursa yoklama durmaz, veri değişmediyse yeniden render edilmez.
   */
  private initTransactionStream(): void {
    this.refresh$
      .pipe(
        startWith(undefined),
        switchMap(() => timer(0, TRANSACTION_POLL_MS)),
        filter(() => !this.document.hidden),
        switchMap(() =>
          this.dashboardService
            .getRecentTransactions(this.transactionLimit(), this.appliedTxnSearch())
            .pipe(
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
    this.searchInput$
      .pipe(
        debounceTime(TRANSACTION_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((term) => {
        this.appliedTxnSearch.set(term);
        this.refresh$.next();
      });
  }

  protected onTxnSearch(value: string): void {
    this.txnSearch.set(value);
    this.searchInput$.next(value.trim());
  }

  private transactionLimit(): number {
    return this.showAllTransactions() || this.dialogVisible()
      ? TRANSACTION_LIMIT_FULL
      : TRANSACTION_LIMIT_DEFAULT;
  }

  /** Tam ekran işlemler tablosu diyaloğunu açar ve 100 limitli veriyi anında çeker. */
  protected openDialog(): void {
    this.dialogVisible.set(true);
    this.refresh$.next();
  }

  protected toggleAllTransactions(): void {
    this.showAllTransactions.update((v) => !v);
    this.refresh$.next();
  }
}
