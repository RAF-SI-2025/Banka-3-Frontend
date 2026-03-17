Cypress.Commands.add("login", (email, password) => {
  cy.visit("/login");
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should("include", "/employees");
});

Cypress.Commands.add("loginBypass", () => {
  cy.window().then((win) => {
    win.localStorage.setItem("accessToken", "mock_access_token_123");
  });
});

Cypress.Commands.add("loginReal", (email, password) => {
  cy.request("POST", "/api/login", { email, password }).then((resp) => {
    cy.window().then((win) => {
      win.localStorage.setItem("accessToken", resp.body.access_token);
      win.localStorage.setItem("refreshToken", resp.body.refresh_token);
    });
  });
});
