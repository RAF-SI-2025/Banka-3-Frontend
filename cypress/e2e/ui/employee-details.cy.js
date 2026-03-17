describe("Pregled zaposlenog", () => {
  beforeEach(() => {
    cy.loginBypass();
    cy.intercept("GET", "**/api/employees/1", {
      body: {
        id: 1,
        first_name: "Petar",
        last_name: "Petrović",
        email: "petar@primer.rs",
        position: "Menadžer",
        active: true,
      },
    }).as("getEmployee");
  });

  it("klik na zaposlenog otvara details", () => {
    cy.visit("/employees");
    cy.get(".employee-row").first().find("td").first().click();
    cy.url().should("include", "/employees/1");
  });

  it("prikazuje podatke zaposlenog", () => {
    cy.visit("/employees/1");
    cy.wait("@getEmployee");
    cy.contains("Petar");
    cy.contains("petar@primer.rs");
  });

  it("dugme Uredi profil vodi na edit stranicu", () => {
    cy.visit("/employees/1");
    cy.wait("@getEmployee");
    cy.contains("button", "Uredi profil").click();
    cy.url().should("include", "/employees/edit/1");
  });

  it("dugme Promeni lozinku vodi na change password", () => {
    cy.visit("/employees/1");
    cy.wait("@getEmployee");
    cy.contains("button", "Promeni lozinku").click();
    cy.url().should("include", "/change-password");
  });
});
