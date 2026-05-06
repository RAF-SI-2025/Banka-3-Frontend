Cypress.Commands.add(
  "seedSession",
  ({
    accessToken = "mock_access_token_123",
    refreshToken = "mock_refresh_token_123",
    userRole = "employee",
    permissions = ["admin"],
  } = {}) => {
    cy.window().then((win) => {
      win.sessionStorage.setItem("accessToken", accessToken);
      win.sessionStorage.setItem("refreshToken", refreshToken);
      win.sessionStorage.setItem("userRole", userRole);
      win.sessionStorage.setItem("permissions", JSON.stringify(permissions));
    });
  }
);

Cypress.Commands.add("loginBypass", () => {
  cy.window().then((win) => {
    win.sessionStorage.setItem("accessToken", "mock_access_token_123");
    win.sessionStorage.setItem("refreshToken", "mock_refresh_token_123");
  });
});

Cypress.Commands.add("visitAsEmployee", (path = "/employees", options = {}) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.sessionStorage.setItem("accessToken", "mock_access_token_123");
      win.sessionStorage.setItem("refreshToken", "mock_refresh_token_123");
      win.sessionStorage.setItem("userRole", "employee");
      win.sessionStorage.setItem("permissions", JSON.stringify(["admin"]));
    },
    ...options,
  });
});

Cypress.Commands.add("visitAsClient", (path = "/dashboard", options = {}) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.sessionStorage.setItem("accessToken", "mock_access_token_123");
      win.sessionStorage.setItem("refreshToken", "mock_refresh_token_123");
      win.sessionStorage.setItem("userRole", "client");
      win.sessionStorage.setItem("permissions", JSON.stringify([]));
    },
    ...options,
  });
});

Cypress.Commands.add("stubEmployeesList", (employees) => {
  cy.intercept("GET", "**/api/employees*", {
    statusCode: 200,
    body: employees,
  }).as("getEmployees");
});

Cypress.Commands.add("stubEmployeeDetails", (employee) => {
  cy.intercept("GET", `**/api/employees/${employee.id}`, {
    statusCode: 200,
    body: employee,
  }).as("getEmployee");
});

Cypress.Commands.add("loginWithBackend", (email = "jovana@primer.raf", password = "Test1234!") => {
  cy.request({
    method: "POST",
    url: "/api/login",
    body: { email, password },
  }).then((resp) => {
    const accessToken = resp.body.accessToken || resp.body.access_token;
    const refreshToken = resp.body.refreshToken || resp.body.refresh_token;
    
    cy.window().then((win) => {
      win.sessionStorage.setItem("accessToken", accessToken);
      win.sessionStorage.setItem("refreshToken", refreshToken);
    });
  });
});

Cypress.Commands.add("visitPayments", () => {
  cy.loginWithBackend();
  cy.visit("/payments");
});

Cypress.Commands.add("visitTransfer", () => {
  cy.loginWithBackend();
  cy.visit("/transfer");
});

Cypress.Commands.add("visitPayment", () => {
  cy.loginWithBackend();
  cy.visit("/payment");
});

Cypress.Commands.add("filterByStatus", (status) => {
  cy.contains(status).click();
  cy.get(".pp-filter-pill--active").should("contain", status);
});

Cypress.Commands.add("filterByType", (type) => {
  cy.contains(type).click();
});

Cypress.Commands.add("openTransactionDetail", (index = 0) => {
  cy.get(".pp-row").eq(index).click();
  cy.contains("Detalji plaćanja").should("be.visible");
});

Cypress.Commands.add("goBackToList", () => {
  cy.get(".pp-back-btn").click();
  cy.contains("Pregled plaćanja").should("be.visible");
});

Cypress.Commands.add("resetAllFilters", () => {
  cy.contains("Resetuj sve filtere").click();
  cy.get(".pp-filter-pill--active").should("contain", "Sve");
});

// ---------------------------------------------------------------------------
// Trading-suite helpers (used by trading-day-e2e + per-feature integration specs).
// All assume real backend (cypress/e2e/integration/*).
// ---------------------------------------------------------------------------

const ROLE_CREDENTIALS = {
  admin:      { email: "admin@banka.raf",      password: "Admin123!" },
  agent:      { email: "agent@banka.raf",      password: "Test1234!" },
  supervisor: { email: "supervisor@banka.raf", password: "Test1234!" },
  client:     { email: "marko@primer.raf",     password: "Test1234!" },
};

// Login via API and seed sessionStorage so subsequent cy.visit() lands authenticated.
// Returns the access token via the yield chain (use cy.loginAs(...).then(token => ...)).
Cypress.Commands.add("loginAs", (role) => {
  const creds = ROLE_CREDENTIALS[role];
  if (!creds) throw new Error(`Unknown role: ${role}`);
  return cy
    .request({ method: "POST", url: "/api/login", body: creds })
    .then((resp) => {
      const accessToken = resp.body.accessToken || resp.body.access_token;
      const refreshToken = resp.body.refreshToken || resp.body.refresh_token;
      const userId = resp.body.userId || resp.body.user_id;
      const permissions = resp.body.permissions || [];
      // userRole is what ProtectedRoute checks; backend doesn't return it, derive from creds.
      const userRole = role === "client" ? "client" : "employee";
      cy.window().then((win) => {
        win.sessionStorage.setItem("accessToken", accessToken);
        win.sessionStorage.setItem("refreshToken", refreshToken);
        if (userId != null) win.sessionStorage.setItem("userId", String(userId));
        win.sessionStorage.setItem("userRole", userRole);
        win.sessionStorage.setItem("permissions", JSON.stringify(permissions));
      });
      return cy.wrap(accessToken);
    });
});

// Force a single exchange open via PATCH /exchanges/:id/open-override. Resolves the
// MIC code → exchange id at runtime so tests don't have to hardcode IDs.
Cypress.Commands.add("setExchangeOpen", (micCode, open = true) => {
  return cy.window().then((win) => {
    const token = win.sessionStorage.getItem("accessToken");
    if (!token) throw new Error("setExchangeOpen requires prior login (loginAs)");
    return cy
      .request({
        method: "GET",
        url: "/api/exchanges",
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((resp) => {
        const ex = (resp.body || []).find((e) => e.mic_code === micCode);
        if (!ex) throw new Error(`Exchange MIC=${micCode} not found in /exchanges`);
        return cy.request({
          method: "PATCH",
          url: `/api/exchanges/${ex.id}/open-override`,
          headers: { Authorization: `Bearer ${token}` },
          body: { open_override: open },
        }).then(() => cy.wrap(ex));
      });
  });
});

// Inverse of setExchangeOpen — force-closes an exchange regardless of the
// wall clock or open_override (#46). Required for closed-market tests that
// need to run during NY business hours without time control.
Cypress.Commands.add("setExchangeClosed", (micCode, closed = true) => {
  return cy.window().then((win) => {
    const token = win.sessionStorage.getItem("accessToken");
    if (!token) throw new Error("setExchangeClosed requires prior login (loginAs)");
    return cy
      .request({
        method: "GET",
        url: "/api/exchanges",
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((resp) => {
        const ex = (resp.body || []).find((e) => e.mic_code === micCode);
        if (!ex) throw new Error(`Exchange MIC=${micCode} not found in /exchanges`);
        return cy.request({
          method: "PATCH",
          url: `/api/exchanges/${ex.id}/closed-override`,
          headers: { Authorization: `Bearer ${token}` },
          body: { closed_override: closed },
        }).then(() => cy.wrap(ex));
      });
  });
});

// Resolve a listing by ticker (e.g. "MSFT") on a given MIC. Returns the listing object.
Cypress.Commands.add("findListingByTicker", (ticker) => {
  return cy.window().then((win) => {
    const token = win.sessionStorage.getItem("accessToken");
    if (!token) throw new Error("findListingByTicker requires prior login (loginAs)");
    return cy
      .request({
        method: "GET",
        url: "/api/listings",
        headers: { Authorization: `Bearer ${token}` },
        qs: { search: ticker },
      })
      .then((resp) => {
        const found = (resp.body || []).find((l) => l.ticker === ticker);
        if (!found) throw new Error(`Listing ${ticker} not found`);
        return cy.wrap(found);
      });
  });
});

// Place an order through the public POST /orders endpoint. Body shape mirrors what
// CreateOrderModal sends (see src/components/CreateOrderModal.jsx:115-127).
Cypress.Commands.add("createOrderApi", (payload) => {
  return cy.window().then((win) => {
    const token = win.sessionStorage.getItem("accessToken");
    if (!token) throw new Error("createOrderApi requires prior login (loginAs)");
    return cy.request({
      method: "POST",
      url: "/api/orders",
      headers: { Authorization: `Bearer ${token}` },
      body: payload,
      failOnStatusCode: false,
    });
  });
});

// Fetch a single order's row from the supervisor list. Used after createOrderApi when
// the test needs fields the create endpoint doesn't return (commission, order_type,
// all_or_none, etc — POST /orders returns only {order_id, status}).
Cypress.Commands.add("getOrderById", (orderId) => {
  // GET /orders is supervisor-only (gateway/handlers.go:152). Do an out-of-band
  // supervisor login so we don't disturb the caller's sessionStorage token.
  return cy
    .request({ method: "POST", url: "/api/login", body: ROLE_CREDENTIALS.supervisor })
    .then((loginResp) => {
      const supToken = loginResp.body.accessToken || loginResp.body.access_token;
      return cy.request({
        method: "GET",
        url: "/api/orders",
        headers: { Authorization: `Bearer ${supToken}` },
        qs: { status: "all" },
      });
    })
    .then((resp) => {
      const found = (resp.body || []).find((o) => o.id === orderId);
      if (!found) throw new Error(`Order id=${orderId} not visible to supervisor`);
      return cy.wrap(found);
    });
});

// Wait until a predicate over the order's current state holds, polling /orders/:id-ish
// via the supervisor list endpoint (no per-id GET exists). Default 30s budget.
Cypress.Commands.add("waitForOrderStatus", (orderId, expected, opts = {}) => {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const stepMs = opts.stepMs ?? 1000;
  const start = Date.now();
  const tryOnce = () =>
    cy.window().then((win) => {
      const token = win.sessionStorage.getItem("accessToken");
      return cy
        .request({
          method: "GET",
          url: "/api/orders",
          headers: { Authorization: `Bearer ${token}` },
          qs: { status: "all" },
          failOnStatusCode: false,
        })
        .then((resp) => {
          const found = (resp.body || []).find((o) => o.id === orderId);
          const matched = found && (Array.isArray(expected) ? expected.includes(found.status) : found.status === expected);
          if (matched) return cy.wrap(found);
          if (Date.now() - start > timeoutMs) {
            throw new Error(
              `waitForOrderStatus(${orderId}, ${JSON.stringify(expected)}) timed out — last status=${found?.status}`
            );
          }
          return cy.wait(stepMs).then(tryOnce);
        });
    });
  return tryOnce();
});
