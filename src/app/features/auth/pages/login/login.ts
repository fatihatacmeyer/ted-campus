import { Component, OnInit, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild, inject, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { first } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit, AfterViewInit {
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

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

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

    this.loginForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = null;
        this.errorType = null;
        this.cdr.markForCheck();
      }
    });
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

    this.authService
      .login(this.loginForm.value.username, this.loginForm.value.password)
      .pipe(first(), takeUntilDestroyed(this.destroyRef))
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
  }

  private parseAndSetError(err: HttpErrorResponse | Error): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        this.errorMessage = 'LOGIN.ERROR_NETWORK';
      } else if (err.status === 429) {
        this.errorMessage = 'LOGIN.ERROR_TOO_MANY_ATTEMPTS';
      } else {
        this.errorMessage = 'LOGIN.ERROR_SERVER';
      }
      this.errorType = 'network';
    } else if (err.message) {
      this.errorMessage = err.message;
      this.errorType = 'credential';
    } else {
      this.errorMessage = 'LOGIN.ERROR_UNEXPECTED';
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
      return controlName === 'username' ? 'LOGIN.ERROR_USERNAME_REQUIRED' : 'LOGIN.ERROR_PASSWORD_REQUIRED';
    }
    return '';
  }
}
