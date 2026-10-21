import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUserValue;

  const isAdmin = user?.admin === true; //|| user?.admin === 1;

  if (isAdmin) {
    return true;
  }

  return router.parseUrl('/home');
};
