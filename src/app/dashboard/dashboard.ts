import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PersonService } from '../services/person.service';
import { Person, UserDef, getUserDefLabel, getUserDefBadgeClass } from '../core/person.model';
import { AuthService } from '../services/auth.service';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

/** Geçiş cihazı işlem satırı模拟类型 — gerçek API bağlandığında Person veya ayrı bir interface ile değiştirilecek. */
export interface AccessTransaction {
  id: number;
  personName: string;
  sicilno: string;
  userdef: number;
  cardid: string;
  time: string;
  direction: 'Giriş' | 'Çıkış';
  device: string;
  result: 'Başarılı' | 'Başarısız';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ButtonModule, ProgressSpinnerModule, DialogModule, TooltipModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  /* ── State ─────────────────────────────────────────────── */
  isLoading = false;
  errorMessage = '';

  allPersons: Person[] = [];
  students: Person[] = [];
  teachers: Person[] = [];
  parents: Person[] = [];

  studentCount = 0;
  teacherCount = 0;
  parentCount = 0;

  /** İçerideki personel = öğrenci + öğretmen */
  get insiderCount(): number {
    return this.studentCount + this.teacherCount;
  }

  /** Erken çıkan kişiler — öğrenci + öğretmen (cikistarih dolu) */
  earlyLeavers: Person[] = [];

  /** Geç kalan kişiler (mock veri) */
  lateArrivals: { name: string; sicilno: string; time: string; expected: string; delay: string }[] =
    [];

  /** Son 100 işlem mock */
  recentTransactions: AccessTransaction[] = [];
  displayedTransactions: AccessTransaction[] = [];
  showAllTransactions = false;

  /** Etkinlik kişi listesi (mock) */
  eventPersons: { name: string; role: string; task: string; status: string }[] = [];

  /* ── Dialog states ─────────────────────────────────────── */
  txnDialogVisible = false;
  earlyLeaverDialogVisible = false;
  lateDialogVisible = false;
  eventDialogVisible = false;

  /* ── Inject ────────────────────────────────────────────── */
  private personService = inject(PersonService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  /* ── Lifecycle ─────────────────────────────────────────── */
  ngOnInit(): void {
    this.fetchData();
  }

  /* ── Data ──────────────────────────────────────────────── */
  fetchData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.personService.getPersonList().subscribe({
      next: (data: Person[]) => {
        this.allPersons = data;

        // Gerçek veriye dayalı sayılar
        this.students = data.filter((p) => p.userdef === UserDef.Ogrenci);
        this.teachers = data.filter((p) => p.userdef === UserDef.Ogretmen);
        this.parents = data.filter((p) => p.userdef === UserDef.Veli);

        this.studentCount = this.students.length;
        this.teacherCount = this.teachers.length;
        this.parentCount = this.parents.length;

        // Erken çıkan kişiler — öğrenci ve öğretmen, cikistarih dolu olanlar
        this.earlyLeavers = [...this.students, ...this.teachers].filter(
          (p) => p.cikistarih && p.cikistarih !== '0' && p.cikistarih.trim() !== '',
        );

        // Geç kalan mock veri (öğrencilerden rastgele 5 tanesi)
        this.generateMockLateArrivals();

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

  /* ── Mock veri üreticileri (gerçek API bağlandığında kaldırılacak) ── */

  private generateMockLateArrivals(): void {
    const source = this.students.length > 0 ? this.students : this.teachers;
    const shuffled = [...source].sort(() => 0.5 - Math.random());
    const count = Math.min(5, shuffled.length);

    this.lateArrivals = shuffled.slice(0, count).map((p, i) => {
      const delayMinutes = Math.floor(Math.random() * 45) + 5;
      const expectedHour = 8;
      const actualMinutes = delayMinutes;
      const h = String(expectedHour).padStart(2, '0');
      const m = String(60 - delayMinutes > 0 ? 60 - delayMinutes : 0).padStart(2, '0');
      return {
        name: p.adsoyad,
        sicilno: p.sicilno,
        time: `08:${String(actualMinutes).padStart(2, '0')}`,
        expected: `${h}:00`,
        delay: `${delayMinutes} dk`,
      };
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
      return {
        id: i + 1,
        personName: person?.adsoyad ?? 'Bilinmeyen',
        sicilno: person?.sicilno ?? '',
        userdef: person?.userdef ?? 0,
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

    this.eventPersons = shuffled.slice(0, count).map((p) => ({
      name: p.adsoyad,
      role: roles[Math.floor(Math.random() * roles.length)],
      task: tasks[Math.floor(Math.random() * tasks.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
    }));
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

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi Günler';
    return 'İyi Akşamlar';
  }

  getUserName(): string {
    return (
      this.authService.currentUserValue?.fullname || this.authService.currentUserValue?.loginname || 'Kullanıcı'
    );
  }

  getUserdefBadge(userdef: number): string {
    return getUserDefLabel(userdef);
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('');
  }

  getUserdefBadgeClass(userdef: number): string {
    return getUserDefBadgeClass(userdef);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Onaylandı':
        return 'status-approved';
      case 'Beklemede':
        return 'status-pending';
      case 'Tamamlandı':
        return 'status-done';
      default:
        return '';
    }
  }
}
