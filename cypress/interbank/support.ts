// Support file for the cypress interbank suite. Adds two custom
// commands so specs can talk to either bank by name:
//
//   cy.bankRequest('bank1' | 'bank2', { method, url, ... })
//   cy.bankLogin('bank1' | 'bank2', email, password)
//
// All requests are sent with failOnStatusCode:false so specs can
// assert non-2xx responses explicitly.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      bankBase(target: 'bank1' | 'bank2'): Chainable<string>
      bankLogin(target: 'bank1' | 'bank2', email: string, password: string): Chainable<string>
      bankRequest(
        target: 'bank1' | 'bank2',
        opts: Partial<Cypress.RequestOptions> & { url: string },
        token?: string,
      ): Chainable<Cypress.Response<unknown>>
    }
  }
}

Cypress.Commands.add('bankBase', (target) => {
  const base = target === 'bank1' ? Cypress.env('BANK1_BASE') : Cypress.env('BANK2_BASE')
  return cy.wrap(base as string, { log: false })
})

Cypress.Commands.add('bankLogin', (target, email, password) => {
  return cy.bankBase(target).then((base) =>
    cy
      .request<{ accessToken: string }>({
        method: 'POST',
        url: `${base}/api/v1/auth/login`,
        body: { email, password },
        failOnStatusCode: false,
      })
      .then((resp) => {
        if (resp.status !== 200) throw new Error(`login ${target} failed: ${resp.status}`)
        return resp.body.accessToken
      }),
  )
})

Cypress.Commands.add('bankRequest', (target, opts, token) => {
  return cy.bankBase(target).then((base) => {
    const url = opts.url.startsWith('http') ? opts.url : `${base}${opts.url}`
    const headers = {
      ...(opts.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    return cy.request<unknown>({
      ...opts,
      url,
      headers,
      failOnStatusCode: false,
    })
  })
})

export {}
