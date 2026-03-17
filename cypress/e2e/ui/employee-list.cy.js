describe("Lista zaposlenih", () => {
  beforeEach(() => {
    cy.loginBypass();
    cy.visit("/employees");
  });

  it("employees stranica se ucitava sa heading-om", () => {
    cy.contains("h3", "Zaposleni");
  });

  it("tabela prikazuje zaposlene sa kolonama", () => {
    cy.get(".employee-table").should("be.visible");
    cy.get(".employee-table thead th").should("contain", "ID");
    cy.get(".employee-table thead th").should("contain", "Ime");
    cy.get(".employee-table thead th").should("contain", "Prezime");
    cy.get(".employee-table thead th").should("contain", "Email");
    cy.get(".employee-table thead th").should("contain", "Pozicija");
    cy.get(".employee-row").should("have.length", 4);
  });

  it("podaci zaposlenog su tacni", () => {
    cy.get(".employee-row")
      .first()
      .within(() => {
        cy.get("td").should("contain", "Petar");
        cy.get("td").should("contain", "Petrović");
        cy.get("td").should("contain", "petar@primer.rs");
        cy.get("td").should("contain", "Menadžer");
      });
  });

  it("klik na red vodi na details stranicu", () => {
    cy.get(".employee-row").first().find("td").first().click();
    cy.url().should("include", "/employees/1");
  });

  it("search, filter, reset i add dugmad su vidljivi", () => {
    cy.get(".search").should("be.visible");
    cy.get(".position-filter").should("be.visible");
    cy.get(".reset-btn").should("be.visible");
    cy.get(".add-btn").should("be.visible");
  });

  it("filter info prikazuje tacan broj", () => {
    cy.get(".filter-info").should("contain", "4");
  });
});
