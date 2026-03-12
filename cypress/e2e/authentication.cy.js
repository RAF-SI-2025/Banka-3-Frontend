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
    cy.visit("/login");
    cy.get('input[type="email"]').type("admin@bank.com");
    cy.get('input[type="password"]').type("admin123");
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/employees");
    cy.window().then((win) => {
      expect(win.localStorage.getItem("accessToken")).to.eq(
        "mock_access_token_123"
      );
    });
  });

  it("neuspesna prijava prikazuje gresku", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type("wrong@email.com");
    cy.get('input[type="password"]').type("wrongpass");
    cy.get('button[type="submit"]').click();
    cy.get(".message").should("contain", "Pogrešan email ili lozinka");
  });

  it("neulogovan korisnik ne moze pristupiti /employees", () => {
    cy.visit("/employees");
    cy.url().should("include", "/login");
  });
});
