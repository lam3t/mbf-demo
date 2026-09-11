import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Alert } from '../models';

export interface AlertsResponse {
  success: boolean;
  data: Alert[];
  unreadCount: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private recentAlertsSubject = new BehaviorSubject<Alert[]>([]);
  public recentAlerts$ = this.recentAlertsSubject.asObservable();

  constructor(private api: ApiService) {
    // Initial fetch
    this.refreshRecent();
  }

  refreshRecent(): void {
    this.api.get<AlertsResponse>('/alerts', { limit: 5 }).subscribe({
      next: res => {
        if (res && res.success) {
          this.unreadCountSubject.next(res.unreadCount || 0);
          this.recentAlertsSubject.next(res.data || []);
        }
      },
      error: () => {}
    });
  }

  getAlerts(params: any = {}): Observable<AlertsResponse> {
    return this.api.get<AlertsResponse>('/alerts', params).pipe(
      tap(res => {
        if (res && res.success && res.unreadCount !== undefined) {
          this.unreadCountSubject.next(res.unreadCount);
        }
      })
    );
  }

  markAsRead(id: number): Observable<any> {
    return this.api.patch(`/alerts/${id}/read`, {}).pipe(
      tap(() => {
        this.refreshRecent();
      })
    );
  }

  markAllAsRead(): Observable<any> {
    return this.api.patch('/alerts/read-all', {}).pipe(
      tap(() => {
        this.unreadCountSubject.next(0);
        this.refreshRecent();
      })
    );
  }

  triggerDeadlineCheck(): Observable<any> {
    return this.api.post('/alerts/check-deadlines', {}).pipe(
      tap(() => {
        this.refreshRecent();
      })
    );
  }
}
