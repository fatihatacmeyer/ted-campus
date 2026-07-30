import { inject, Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      return true;
    }

    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
