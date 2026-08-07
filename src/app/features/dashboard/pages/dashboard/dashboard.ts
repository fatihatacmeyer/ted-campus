import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
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
} from '../../../../core/models/person.model';
import { AuthService } from '../../../../core/services/auth.service';
import {
  DashboardService,
  DashboardCampusStats,
  EarlyLeaver,
  LateArrival,
  Absentee,
} from '../../services/dashboard.service';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { CommonModule } from '@angular/common';

/** Geçiş cihazı işlem satırı模拟类型 — gerçek API bağlandığında Person veya ayrı bir interface ile değiştirilecek. */
export interface AccessTransaction {
  id: number;
  personName: string;
  sicilno: string;
  userdef: number;
  badgeClass: string;
  badgeLabel: string;
  cardid: string;
  time: string;
  direction: 'Giriş' | 'Çıkış';
  device: string;
  result: 'Başarılı' | 'Başarısız';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ButtonModule, ProgressSpinnerModule, DialogModule, TooltipModule, CommonModule],
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

  /** Son 100 işlem mock */
  recentTransactions: AccessTransaction[] = [];
  displayedTransactions: AccessTransaction[] = [];
  showAllTransactions = false;

  /** Etkinlik kişi listesi (mock) */
  eventPersons: {
    name: string;
    role: string;
    task: string;
    status: string;
    initials: string;
    statusClass: string;
  }[] = [];

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

  /* ── Lifecycle ─────────────────────────────────────────── */
  ngOnInit(): void {
    this.greeting = this.buildGreeting();
    this.userName =
      this.authService.currentUserValue?.fullname ||
      this.authService.currentUserValue?.loginname ||
      'Kullanıcı';
    this.fetchData();
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

          // İşlem listesi mock
          this.generateMockTransactions();

          // Etkinlik listesi mock
          this.generateMockEventList();

          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Dashboard veri yükleme hatası:', err);
          this.errorMessage = 'Sistem hatası: Veriler yüklenemedi.';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private generateMockTransactions(): void {
    const names = [...this.students, ...this.teachers, ...this.parents];
    const devices = ['Ana Giriş', 'Yan Giriş', 'Bahçe Kapısı', 'Otopark', 'VIP Giriş'];
    const base = new Date();

    this.recentTransactions = Array.from({ length: 100 }, (_, i) => {
      const person = names[Math.floor(Math.random() * names.length)];
      const dir = Math.random() > 0.5 ? 'Giriş' : 'Çıkış';
      const t = new Date(base.getTime() - i * 120000 + Math.floor(Math.random() * 60000));
      const userdef = person?.userdef ?? 0;
      return {
        id: i + 1,
        personName: person?.adsoyad ?? 'Bilinmeyen',
        sicilno: person?.sicilno ?? '',
        userdef,
        badgeClass: getUserDefBadgeClass(userdef),
        badgeLabel: getUserDefLabel(userdef),
        cardid: person?.cardid ?? '',
        time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`,
        direction: dir,
        device: devices[Math.floor(Math.random() * devices.length)],
        result: Math.random() > 0.05 ? 'Başarılı' : 'Başarısız',
      };
    });

    this.displayedTransactions = this.recentTransactions.slice(0, 10);
  }

  private generateMockEventList(): void {
    const roles = ['Öğrenci', 'Öğretmen', 'Veli', 'Görevli'];
    const tasks = ['Sunum', 'Organizasyon', 'Katılımcı', 'Koordinatör', 'Judelik'];
    const statuses = ['Onaylandı', 'Beklemede', 'Tamamlandı'];

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
          status === 'Onaylandı'
            ? 'status-approved'
            : status === 'Beklemede'
              ? 'status-pending'
              : status === 'Tamamlandı'
                ? 'status-done'
                : '',
      };
    });
  }

  /* ── UI actions ────────────────────────────────────────── */
  toggleAllTransactions(): void {
    this.showAllTransactions = !this.showAllTransactions;
    this.displayedTransactions = this.showAllTransactions
      ? this.recentTransactions
      : this.recentTransactions.slice(0, 10);
  }

  navigateTo(path: string): void {
    this.router.navigate(['/home', path]);
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi Günler';
    return 'İyi Akşamlar';
  }

  getUserdefBadge(userdef: number): string {
    return getUserDefLabel(userdef);
  }

  getUserdefBadgeClass(userdef: number): string {
    return getUserDefBadgeClass(userdef);
  }
}
