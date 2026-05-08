import { create } from 'zustand'
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

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  userId: null,
  userKind: null,
  permissions: [],

  setLogin: ({ accessToken, userId, userKind, permissions }) =>
    set({ accessToken, userId, userKind, permissions }),

  setAccessToken: (accessToken) => {
    // Refresh response doesn't echo back the user identity; we keep the
    // existing identity but pull the latest permissions out of the JWT.
    const perms = jwtDecodePermissions(accessToken)
    set({ accessToken, permissions: perms ?? get().permissions })
  },

  clear: () => set({ accessToken: null, userId: null, userKind: null, permissions: [] }),

  has: (perm) => get().permissions.includes(perm) || get().permissions.includes('admin'),
}))
