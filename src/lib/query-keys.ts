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
  listing: {
    all: ['listing'] as const,
    list: (args: object) => ['listing', 'list', args] as const,
    detail: (id: string) => ['listing', 'detail', id] as const,
    history: (id: string) => ['listing', 'history', id] as const,
  },
  security: {
    all: ['security'] as const,
    list: (args: object) => ['security', 'list', args] as const,
    detail: (id: string) => ['security', 'detail', id] as const,
    optionChain: (stockId: string, args: object) => ['security', 'optionChain', stockId, args] as const,
  },
  exchange: {
    all: ['exchange'] as const,
    list: () => ['exchange', 'list'] as const,
  },
  order: {
    all: ['order'] as const,
    list: (args: object) => ['order', 'list', args] as const,
    detail: (id: string) => ['order', 'detail', id] as const,
    mine: (args: object) => ['order', 'mine', args] as const,
    pending: (args: object) => ['order', 'pending', args] as const,
  },
  portfolio: {
    all: ['portfolio'] as const,
    list: (userId: string, kind?: string) => ['portfolio', 'list', userId, kind ?? ''] as const,
    position: (userId: string, securityId: string) => ['portfolio', 'position', userId, securityId] as const,
  },
  actuary: {
    all: ['actuary'] as const,
    list: (args: object) => ['actuary', 'list', args] as const,
    detail: (id: string) => ['actuary', 'detail', id] as const,
  },
  tax: {
    all: ['tax'] as const,
    board: (args: object) => ['tax', 'board', args] as const,
    realized: (args: object) => ['tax', 'realized', args] as const,
    runs: ['tax', 'runs'] as const,
  },
} as const
