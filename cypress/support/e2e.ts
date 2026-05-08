// Cypress support file. Pulls in @testing-library/cypress so specs can
// query by accessible label / role just like Vitest tests do.

import '@testing-library/cypress/add-commands'

// Suppress hydration / refresh-cookie 401 noise on the initial page
// load: tests intercept what they care about; everything else is a
// preflight failure we don't want stopping the run.
Cypress.on('uncaught:exception', () => false)

export {}
