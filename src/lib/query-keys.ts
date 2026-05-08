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
  client: {
    all: ['client'] as const,
    list: (args: object) => ['client', 'list', args] as const,
    detail: (id: string) => ['client', 'detail', id] as const,
  },
  employee: {
    all: ['employee'] as const,
    list: (args: object) => ['employee', 'list', args] as const,
    detail: (id: string) => ['employee', 'detail', id] as const,
  },
  account: {
    all: ['account'] as const,
    list: (args: object) => ['account', 'list', args] as const,
    detail: (id: string) => ['account', 'detail', id] as const,
  },
  card: {
    all: ['card'] as const,
    list: (args: object) => ['card', 'list', args] as const,
  },
  company: {
    all: ['company'] as const,
    list: (args: object) => ['company', 'list', args] as const,
    detail: (id: string) => ['company', 'detail', id] as const,
  },
  authorizedPerson: {
    all: ['authorizedPerson'] as const,
    list: (companyId?: string) => ['authorizedPerson', 'list', companyId ?? ''] as const,
  },
  transaction: {
    all: ['transaction'] as const,
    list: (args: object) => ['transaction', 'list', args] as const,
  },
  recipient: {
    all: ['recipient'] as const,
    list: () => ['recipient', 'list'] as const,
  },
  loan: {
    all: ['loan'] as const,
    list: (args: object) => ['loan', 'list', args] as const,
    detail: (id: string) => ['loan', 'detail', id] as const,
  },
  loanRequest: {
    all: ['loanRequest'] as const,
    list: (args: object) => ['loanRequest', 'list', args] as const,
  },
  rates: {
    all: ['rates'] as const,
  },
} as const
