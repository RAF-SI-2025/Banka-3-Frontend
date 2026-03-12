describe("Filtriranje zaposlenih", () => {
  beforeEach(() => {
    cy.loginBypass();
    cy.visit("/employees");
    cy.get(".employee-row").should("have.length", 4);
  });

  it("search po imenu filtrira listu", () => {
    cy.get(".search").type("Petar");
    cy.get(".employee-row").should("have.length", 1);
    cy.get(".employee-row").should("contain", "Petar");
  });

  it("search po emailu filtrira listu", () => {
    cy.get(".search").type("ana@");
    cy.get(".employee-row").should("have.length", 1);
    cy.get(".employee-row").should("contain", "Ana");
  });

  it("filter po poziciji", () => {
    cy.get(".position-filter").select("Analitičar");
    cy.get(".employee-row").should("have.length", 2);
  });

  it("kombinacija search i position filter", () => {
    cy.get(".search").type("Nikola");
    cy.get(".position-filter").select("Analitičar");
    cy.get(".employee-row").should("have.length", 2);
  });

  it("nema rezultata prikazuje poruku", () => {
    cy.get(".search").type("xyz");
    cy.get(".no-results").should("be.visible");
  });

  it("filter info se azurira", () => {
    cy.get(".search").type("Petar");
    cy.get(".filter-info").should("contain", "1");
  });

  it("reset dugme resetuje filtere", () => {
    cy.get(".search").type("Petar");
    cy.get(".position-filter").select("Analitičar");
    cy.get(".reset-btn").click();
    cy.get(".employee-row").should("have.length", 4);
    cy.get(".search").should("have.value", "");
  });

  it("search je case-insensitive", () => {
    cy.get(".search").type("petar");
    cy.get(".employee-row").should("have.length", 1);
  });
});
