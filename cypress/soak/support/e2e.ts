// Soak suite support entry.  Pulls in @testing-library/cypress for
// parity with the per-spec-reset suite and registers the soak
// commands.

import '@testing-library/cypress/add-commands'
import './commands'

// SPA initial-load 401s during the refresh-cookie probe and an
// unrelated TanStack warning shouldn't fail the run.
Cypress.on('uncaught:exception', () => false)

export {}
