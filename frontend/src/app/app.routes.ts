import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'dashboard/ward/:wardId',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'objects',
        loadComponent: () => import('./features/objects/objects-list.component').then(m => m.ObjectsListComponent)
      },
      {
        path: 'plans',
        loadComponent: () => import('./features/plans/plans-list.component').then(m => m.PlansListComponent)
      },
      {
        path: 'inspections',
        loadComponent: () => import('./features/inspections/inspections-list.component').then(m => m.InspectionsListComponent)
      },
      {
        path: 'map',
        loadComponent: () => import('./features/map/violations-map.component').then(m => m.ViolationsMapComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: 'admin',
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'forbidden',
        loadComponent: () => import('./features/errors/forbidden.component').then(m => m.ForbiddenComponent)
      },
      {
        path: '404',
        loadComponent: () => import('./features/errors/not-found.component').then(m => m.NotFoundComponent)
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/errors/not-found.component').then(m => m.NotFoundComponent)
  }
];
