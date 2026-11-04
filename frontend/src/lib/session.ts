import { reactive } from 'vue';
import type { AuthUser, LoginResponse } from '../types';

const STORAGE_KEY = 'sakila.frontend.session.v1';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

interface SessionState {
  accessToken: string;
  refreshToken: string;
  user: AuthUser | null;
}

export const session = reactive<SessionState>({
  accessToken: '',
  refreshToken: '',
  user: null,
});

let refreshInFlight: Promise<boolean> | null = null;

export function loadSession(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      session.accessToken = parsed.accessToken;
      session.refreshToken = parsed.refreshToken;
      session.user = parsed.user ?? null;
    }
  } catch {
    clearSession();
  }
}

export function persistSession(login: LoginResponse): void {
  session.accessToken = login.access_token;
  session.refreshToken = login.refresh_token;
  session.user = login.user;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: login.access_token,
      refreshToken: login.refresh_token,
      user: login.user,
    }),
  );
}

export function clearSession(): void {
  session.accessToken = '';
  session.refreshToken = '';
  session.user = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(session.accessToken);
}

export function isAdmin(): boolean {
  return session.user?.role === 'ADMIN';
}

export function canWrite(): boolean {
  return session.user?.role === 'ADMIN' || session.user?.role === 'BILLING';
}

/**
 * Renueva el access token. Comparte la misma promesa entre llamadas
 * concurrentes para no consumir el refresh token varias veces.
 */
export async function refreshSession(): Promise<boolean> {
  if (!session.refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        });
        if (!response.ok) {
          clearSession();
          return false;
        }
        const body = (await response.json()) as { data?: LoginResponse };
        if (!body.data?.access_token) {
          clearSession();
          return false;
        }
        persistSession(body.data);
        return true;
      } catch {
        clearSession();
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export function onUnauthorized(): void {
  clearSession();
  window.dispatchEvent(new CustomEvent('sakila:logout'));
}
