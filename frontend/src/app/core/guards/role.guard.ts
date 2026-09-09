import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const currentUser = authService.currentUser();
  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  const expectedRoles = route.data?.['roles'] as UserRole[] | undefined;
  if (!expectedRoles || expectedRoles.length === 0) {
    return true;
  }

  if (expectedRoles.includes(currentUser.role)) {
    return true;
  }

  snackBar.open('Bạn không có quyền truy cập vào phân hệ này!', 'Đóng', {
    duration: 3000,
    panelClass: ['snackbar-warning']
  });

  router.navigate(['/dashboard']);
  return false;
};
