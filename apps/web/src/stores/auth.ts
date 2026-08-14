import { defineStore } from 'pinia';
import { api } from '../api';
import type { UserInfo } from '@police/shared';

function loadUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: loadUser(),
  }),
  getters: {
    isAuthenticated: (s) => !!s.token,
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    persist() {
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));
    },
    async login(username: string, password: string) {
      const r = await api.auth.login({ username, password });
      this.token = r.token;
      this.user = r.user;
      this.persist();
      return r;
    },
    async register(payload: { username: string; password: string; school?: string; education?: string }) {
      const r = await api.auth.register(payload);
      this.token = r.token;
      this.user = r.user;
      this.persist();
      return r;
    },
    async fetchMe() {
      if (!this.token) return;
      try {
        this.user = await api.auth.me();
        this.persist();
      } catch {
        /* ignore */
      }
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});
