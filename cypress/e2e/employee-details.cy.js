describe("Pregled zaposlenog", () => {
  beforeEach(() => {
    cy.loginBypass();
  });

  it("klik na zaposlenog otvara details", () => {
    cy.visit("/employees");
    cy.get(".employee-row").first().find("td").first().click();
    cy.url().should("include", "/employees/1");
  });

  it("prikazuje podatke zaposlenog", () => {
    cy.visit("/employees/1");
    cy.contains("Petar");
    cy.contains("petar@primer.rs");
    cy.contains("Menadžment");
  });

  it("dugme Uredi profil vodi na edit stranicu", () => {
    cy.visit("/employees/1");
    cy.contains("button", "Uredi profil").click();
    cy.url().should("include", "/employees/edit/1");
  });

  it("dugme Promeni lozinku vodi na change password", () => {
    cy.visit("/employees/1");
    cy.contains("button", "Promeni lozinku").click();
    cy.url().should("include", "/change-password");
  });
});
