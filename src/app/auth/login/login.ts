import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('usernameInput') usernameInput!: ElementRef<HTMLInputElement>;
  loginForm!: FormGroup;
  errorMessage: string | null = null;
  errorType: 'credential' | 'network' | null = null;
  showPassword = false;
  capsLockOn = false;
  isSuccess = false;
  isShaking = false;
  returnUrl = '/home';
  isLoading = false;
  private unsubscribe: Subscription[] = [];

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    if (this.authService.currentUserValue) {
      this.router.navigate(['/home']);
    }
  }

  ngOnInit(): void {
    this.initForm();
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
  }

  ngAfterViewInit(): void {
    this.usernameInput.nativeElement.focus();
  }

  initForm() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });

    const formChangesSub = this.loginForm.valueChanges.subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = null;
        this.errorType = null;
        this.cdr.markForCheck();
      }
    });
    this.unsubscribe.push(formChangesSub);
  }

  submit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage = null;
    this.errorType = null;
    this.isLoading = true;
    this.isShaking = false;
    this.cdr.markForCheck();

    const loginSub = this.authService
      .login(this.loginForm.value.username, this.loginForm.value.password)
      .pipe(first())
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.isSuccess = true;
          this.cdr.markForCheck();
          setTimeout(() => {
            this.router.navigate([this.returnUrl]);
          }, 800);
        },
        error: (err: HttpErrorResponse | Error) => {
          this.parseAndSetError(err);
          this.isLoading = false;
          this.isShaking = true;
          setTimeout(() => {
            this.isShaking = false;
            this.cdr.markForCheck();
          }, 500);
          this.cdr.markForCheck();
        },
      });

    this.unsubscribe.push(loginSub);
  }

  private parseAndSetError(err: HttpErrorResponse | Error): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        this.errorMessage = 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
      } else if (err.status === 429) {
        this.errorMessage =
          'Çok fazla hatalı giriş denemesi yaptınız. Lütfen bir süre bekleyip tekrar deneyin.';
      } else {
        this.errorMessage = 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
      }
      this.errorType = 'network';
    } else if (err.message) {
      this.errorMessage = err.message;
      this.errorType = 'credential';
    } else {
      this.errorMessage = 'Beklenmeyen bir hata oluştu.';
      this.errorType = null;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  checkCapsLock(event: KeyboardEvent): void {
    this.capsLockOn = event.getModifierState('CapsLock');
  }

  getErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);
    if (!control) return '';

    if (control.hasError('required')) {
      return controlName === 'username' ? 'Kullanıcı adı gereklidir' : 'Şifre gereklidir';
    }
    return '';
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}
