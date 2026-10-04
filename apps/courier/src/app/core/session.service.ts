import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, switchMap, tap } from 'rxjs';
import { apiUrl } from './api-url';
import { SKIP_AUTH } from './auth-context';

export interface SessionUser {
  id: string;
  name: string;
  role: string;
}

interface AccessTokenResponse {
  accessToken: string;
}

interface UserResponse {
  id: string;
  name: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private token: string | null = null;
  private refreshing: Observable<string> | null = null;
  readonly currentUser = signal<SessionUser | null>(null);

  accessToken(): string | null {
    return this.token;
  }

  user(): SessionUser | null {
    return this.currentUser();
  }

  login(email: string, password: string): Observable<SessionUser> {
    return this.http
      .post<AccessTokenResponse>(
        apiUrl('/api/v1/auth/login'),
        { email, password },
        {
          withCredentials: true,
          context: new HttpContext().set(SKIP_AUTH, true),
        },
      )
      .pipe(
        switchMap((body) => {
          this.token = body.accessToken;
          return this.loadProfile();
        }),
      );
  }

  refresh(): Observable<string> {
    if (this.refreshing !== null) {
      return this.refreshing;
    }

    this.refreshing = this.http
      .post<AccessTokenResponse>(
        apiUrl('/api/v1/auth/refresh'),
        {},
        {
          withCredentials: true,
          context: new HttpContext().set(SKIP_AUTH, true),
        },
      )
      .pipe(
        map((body) => {
          this.token = body.accessToken;
          return body.accessToken;
        }),
        finalize(() => {
          this.refreshing = null;
        }),
        shareReplay(1),
      );
    return this.refreshing;
  }

  loadProfile(): Observable<SessionUser> {
    return this.http.get<UserResponse>(apiUrl('/api/v1/auth/me')).pipe(
      map((user) => ({ id: user.id, name: user.name, role: user.role })),
      tap((user) => this.currentUser.set(user)),
    );
  }

  clear(): void {
    this.token = null;
    this.currentUser.set(null);
  }
}
