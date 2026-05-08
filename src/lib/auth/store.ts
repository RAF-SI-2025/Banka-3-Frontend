import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { jwtDecodePermissions } from './jwt'

export type UserKind = 'employee' | 'client'

export interface AuthSnapshot {
  accessToken: string | null
  userId: string | null
  userKind: UserKind | null
  permissions: string[]
}

interface AuthState extends AuthSnapshot {
  setLogin: (s: { accessToken: string; userId: string; userKind: UserKind; permissions: string[] }) => void
  setAccessToken: (token: string) => void
  clear: () => void
  has: (perm: string) => boolean
}

// We persist to sessionStorage rather than localStorage on purpose:
// sessionStorage dies with the tab, matching the spec's "closing the
// browser must require re-login" rule (p.10), but survives a single
// reload — so users don't get bumped to /login on every refresh.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      userId: null,
      userKind: null,
      permissions: [],

      setLogin: ({ accessToken, userId, userKind, permissions }) =>
        set({ accessToken, userId, userKind, permissions }),

      setAccessToken: (accessToken) => {
        // Refresh response doesn't echo back the user identity; keep
        // the existing identity but pull latest permissions out of the JWT.
        const perms = jwtDecodePermissions(accessToken)
        set({ accessToken, permissions: perms ?? get().permissions })
      },

      clear: () => set({ accessToken: null, userId: null, userKind: null, permissions: [] }),

      has: (perm) => get().permissions.includes(perm) || get().permissions.includes('admin'),
    }),
    {
      name: 'banka-auth',
      storage: createJSONStorage(() =>
        // sessionStorage is unavailable in some test envs (jsdom default),
        // so fall back to an in-memory shim there.
        typeof window !== 'undefined' && window.sessionStorage
          ? window.sessionStorage
          : memoryStorage(),
      ),
      partialize: (s) => ({
        accessToken: s.accessToken,
        userId: s.userId,
        userKind: s.userKind,
        permissions: s.permissions,
      }),
    },
  ),
)

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size
    },
  }
}
