import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
import { BehaviorSubject, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { PersonService } from '../../../persons/services/person.service';
import {
  Person,
  UserDef,
  getUserDefLabel,
  getUserDefBadgeClass,
  getUserDefLabelKey,
} from '../../../../core/models/person.model';
import { AuthService } from '../../../../core/services/auth.service';
import {
  DashboardService,
  DashboardCampusStats,
  EarlyLeaver,
  LateArrival,
  Absentee,
  AccessTransaction,
} from '../../services/dashboard.service';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    ButtonModule,
    ProgressSpinnerModule,
    DialogModule,
    TooltipModule,
    CommonModule,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  readonly UserDef = UserDef;

  /* ── State ─────────────────────────────────────────────── */
  isLoading = false;
  errorMessage = '';

  allPersons: Person[] = [];
  students: Person[] = [];
  teachers: Person[] = [];
  parents: Person[] = [];

  /** sp_DashboardCampus_s'ten gelen özet sayılar (Kayıtlı / Okulda) */
  stats: DashboardCampusStats = {
    studentCount: 0,
    parentCount: 0,
    totalRegisteredCount: 0,
    studentInsideCount: 0,
    parentInsideCount: 0,
    totalInsideCount: 0,
  };

  /** Oturum başına bir kez hesaplanan değerler */
  greeting = '';
  userName = '';

  earlyLeavers: EarlyLeaver[] = [];
  lateArrivals: LateArrival[] = [];
  absentees: Absentee[] = [];

  recentTransactions: AccessTransaction[] = [];
  displayedTransactions: AccessTransaction[] = [];
  showAllTransactions = false;

  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  /** Etkinlik kişi listesi (mock) */
  eventPersons: {
    name: string;
    role: string;
    task: string;
    status: string;
    initials: string;
    statusClass: string;
  }[] = [];

  absenteeForm = { className: '', schoolName: '', reason: '' };

  /* ── Dialog states ─────────────────────────────────────── */
  txnDialogVisible = false;
  earlyLeaverDialogVisible = false;
  lateDialogVisible = false;
  eventDialogVisible = false;
  absentDialogVisible = false;

  /* ── Inject ────────────────────────────────────────────── */
  private personService = inject(PersonService);
  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  /* ── Lifecycle ─────────────────────────────────────────── */
  ngOnInit(): void {
    this.greeting = this.buildGreeting();
    this.userName =
      this.authService.currentUserValue?.fullname ||
      this.authService.currentUserValue?.loginname ||
      this.translate.instant('DASHBOARD.USER');
    this.fetchData();
    this.initTransactionStream();
  }

  /* ── Data ──────────────────────────────────────────────── */
  fetchData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Kartlar sp_DashboardCampus_s'ten, alt paneller ise sicil listesinden beslenir.
    forkJoin({
      stats: this.dashboardService.getDashboardStats(),
      persons: this.personService.getPersonListCampus(),
      earlyLeaversData: this.dashboardService.getEarlyLeavers(),
      lateArrivalsData: this.dashboardService.getLateArrivals(),
      absenteeData: this.dashboardService.getAbsentees(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, persons, earlyLeaversData, lateArrivalsData, absenteeData }) => {
          this.stats = stats;
          this.allPersons = persons;

          // Gerçek veriye dayalı listeler (erken çıkanlar ve mock paneller için)
          this.students = persons.filter((p) => p.userdef === UserDef.Ogrenci);
          this.teachers = persons.filter((p) => p.userdef === UserDef.Ogretmen);
          this.parents = persons.filter((p) => p.userdef === UserDef.Veli);

          this.earlyLeavers = earlyLeaversData;

          this.lateArrivals = lateArrivalsData;

          this.absentees = absenteeData;

          // Etkinlik listesi mock
          this.generateMockEventList();

          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Dashboard veri yükleme hatası:', err);
          this.errorMessage = 'DASHBOARD.LOAD_ERROR';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });

    this.refreshTrigger$.next();
  }

  private initTransactionStream(): void {
    this.refreshTrigger$
      .pipe(
        switchMap(() => timer(0, 1500)),
        switchMap(() => {
          const limit = this.showAllTransactions || this.txnDialogVisible ? 100 : 10;
          return this.dashboardService.getRecentTransactions(limit);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.recentTransactions = data;
          this.displayedTransactions = data;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Son hareketler alınamadı:', err);
        },
      });
  }

  /** Tam Ekran İşlemler Tablosu Dialog'u Açar */
  openTxnDialog(): void {
    this.txnDialogVisible = true;
    this.refreshTrigger$.next(); // 100 limitli veriyi anında çekmek için tetikle
  }

  private generateMockEventList(): void {
    const roles = ['USERDEF.STUDENT', 'USERDEF.TEACHER', 'USERDEF.PARENT', 'USERDEF.STAFF'];
    const tasks = [
      'DASHBOARD.TASK_PRESENTATION',
      'DASHBOARD.TASK_ORGANIZATION',
      'DASHBOARD.TASK_PARTICIPANT',
      'DASHBOARD.TASK_COORDINATOR',
      'DASHBOARD.TASK_JURY',
    ];
    const statuses = ['approved', 'pending', 'completed'];

    const source = [...this.students, ...this.teachers, ...this.parents];
    const shuffled = [...source].sort(() => 0.5 - Math.random());
    const count = Math.min(12, shuffled.length);

    this.eventPersons = shuffled.slice(0, count).map((p) => {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      return {
        name: p.adsoyad,
        role: roles[Math.floor(Math.random() * roles.length)],
        task: tasks[Math.floor(Math.random() * tasks.length)],
        status,
        initials: p.adsoyad
          .split(' ')
          .map((n) => n.charAt(0))
          .join(''),
        statusClass:
          status === 'approved'
            ? 'status-approved'
            : status === 'pending'
              ? 'status-pending'
              : status === 'completed'
                ? 'status-done'
                : '',
      };
    });
  }

  /* ── UI actions ────────────────────────────────────────── */
  toggleAllTransactions(): void {
    this.showAllTransactions = !this.showAllTransactions;
    // this.displayedTransactions = this.showAllTransactions
    //   ? this.recentTransactions
    //   : this.recentTransactions.slice(0, 10);
    this.refreshTrigger$.next();
  }

  navigateTo(path: string): void {
    this.router.navigate(['/home', path]);
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'DASHBOARD.GREETING_MORNING';
    if (hour < 18) return 'DASHBOARD.GREETING_AFTERNOON';
    return 'DASHBOARD.GREETING_EVENING';
  }

  directionLabel(direction: string): string {
    return direction === 'in' ? 'DASHBOARD.DIRECTION_IN' : 'DASHBOARD.DIRECTION_OUT';
  }

  resultLabel(result: string): string {
    return result === 'success' ? 'DASHBOARD.RESULT_SUCCESS' : 'DASHBOARD.RESULT_FAILED';
  }

  statusLabel(status: string): string {
    if (status === 'approved') return 'DASHBOARD.STATUS_APPROVED';
    if (status === 'pending') return 'DASHBOARD.STATUS_PENDING';
    return 'DASHBOARD.STATUS_COMPLETED';
  }

  getUserdefBadge(userdef: number): string {
    return getUserDefLabelKey(userdef);
  }

  getUserdefBadgeClass(userdef: number): string {
    return getUserDefBadgeClass(userdef);
  }

  saveAbsentee(): void {
    // TODO: Implement save absentee logic
    this.absentDialogVisible = false;
    this.absenteeForm = { className: '', schoolName: '', reason: '' };
  }
}
