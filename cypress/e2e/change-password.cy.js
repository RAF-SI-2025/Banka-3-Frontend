describe("Promena lozinke", () => {
  beforeEach(() => {
    cy.loginBypass();
    cy.visit("/employees/1/change-password");
  });

  it("stranica se ucitava", () => {
    cy.contains("h2", "Promena lozinke");
  });

  it("forma sadrzi dva password polja", () => {
    cy.get('input.cp-input[type="password"]').should("have.length", 2);
  });

  it("validacija - lozinke se ne poklapaju", () => {
    cy.get('input.cp-input[type="password"]').first().type("Test123!");
    cy.get('input.cp-input[type="password"]').last().type("Different1!");
    cy.get('button[type="submit"]').click();
    cy.get(".cp-error").should("contain", "ne poklapaju");
  });

  it("validacija - slaba lozinka", () => {
    cy.get('input.cp-input[type="password"]').first().type("123");
    cy.get('input.cp-input[type="password"]').last().type("123");
    cy.get('button[type="submit"]').click();
    cy.get(".cp-error-box").should("be.visible");
  });

  it("uspesna promena lozinke", () => {
    cy.get('input.cp-input[type="password"]').first().type("NewPass1!");
    cy.get('input.cp-input[type="password"]').last().type("NewPass1!");
    cy.get('button[type="submit"]').click();
    cy.get(".cp-success").should("contain", "uspešno");
  });
});
