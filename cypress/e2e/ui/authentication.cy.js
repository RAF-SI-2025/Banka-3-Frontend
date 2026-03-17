describe("Autentifikacija", () => {
  it("login stranica se ucitava", () => {
    cy.visit("/login");
    cy.url().should("include", "/login");
  });

  it("login forma sadrzi email, password i dugme", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').should("be.visible");
    cy.get('input[type="password"]').should("be.visible");
    cy.get('button[type="submit"]').should("be.visible");
  });

  it("ne moze se poslati prazna forma", () => {
    cy.visit("/login");
    cy.get('button[type="submit"]').click();
    cy.get(".message").should("contain", "Unesite email i lozinku");
  });

  it("uspesna prijava cuva token i preusmerava na /employees", () => {
    cy.intercept("POST", "**/login", {
      statusCode: 200,
      body: {
        access_token: "mock_access_token_123",
        refresh_token: "mock_refresh_token_123",
      },
    }).as("loginRequest");

    cy.visit("/login");
    cy.get('input[type="email"]').type("admin@bank.com");
    cy.get('input[type="password"]').type("admin123");
    cy.get('button[type="submit"]').click();
    cy.wait("@loginRequest");
    cy.url().should("include", "/employees");
    cy.window().then((win) => {
      expect(win.localStorage.getItem("accessToken")).to.eq(
        "mock_access_token_123"
      );
    });
  });

  it("neuspesna prijava prikazuje gresku", () => {
    cy.intercept("POST", "**/login", {
      statusCode: 401,
      body: "invalid credentials",
    }).as("loginFail");

    cy.visit("/login");
    cy.get('input[type="email"]').type("wrong@email.com");
    cy.get('input[type="password"]').type("wrongpass");
    cy.get('button[type="submit"]').click();
    cy.wait("@loginFail");
    cy.get(".message").should("contain", "Pogrešan email ili lozinka");
  });

  it("neulogovan korisnik ne moze pristupiti /employees", () => {
    cy.visit("/employees");
    cy.url().should("include", "/login");
  });
});
