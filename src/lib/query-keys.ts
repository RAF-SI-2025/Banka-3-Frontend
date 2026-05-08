// Query key factory. All keys are produced here so cache invalidation can
// be expressed by prefix.
//
// Usage:
//   useQuery({ queryKey: keys.account.detail(id), ... })
//   queryClient.invalidateQueries({ queryKey: keys.account.all })

export const keys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  account: {
    all: ['account'] as const,
    detail: (id: string) => ['account', 'detail', id] as const,
  },
} as const
