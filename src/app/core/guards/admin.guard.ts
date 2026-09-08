import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUserValue;

  const isAdmin = user?.admin === true; //|| user?.admin === 1;

  if (isAdmin) {
    return true; // Adminse geçişe izin ver
  }

  // Admin değilse, zorla anasayfaya (dashboard) yönlendir
  return router.parseUrl('/home');
};
