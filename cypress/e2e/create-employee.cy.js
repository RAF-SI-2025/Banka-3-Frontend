describe("Kreiranje zaposlenog", () => {
  beforeEach(() => {
    cy.loginBypass();
    cy.visit("/employees/create");
  });

  it("stranica se ucitava sa formom", () => {
    cy.contains("h2", "Napravi novog korisnika");
  });

  it("forma sadrzi sva polja", () => {
    cy.get('input[name="ime"]').should("exist");
    cy.get('input[name="prezime"]').should("exist");
    cy.get('input[name="pol"]').should("exist");
    cy.get('input[name="username"]').should("exist");
    cy.get('input[name="adresa"]').should("exist");
    cy.get('input[name="lozinka"]').should("exist");
    cy.get('input[name="potvrda"]').should("exist");
    cy.get('input[name="telefon"]').should("exist");
    cy.get('input[name="datum"]').should("exist");
    cy.get('input[name="email"]').should("exist");
    cy.get('input[name="pozicija"]').should("exist");
  });

  it("validacija - prazna polja prikazuju greske", () => {
    cy.get('button[type="submit"]').click();
    cy.get(".error-msg").should("exist");
  });

  it("uspesno kreiranje prikazuje poruku", () => {
    cy.get('input[name="ime"]').type("Marko");
    cy.get('input[name="prezime"]').type("Marković");
    cy.get('input[name="pol"]').type("Muški");
    cy.get('input[name="username"]').type("markom");
    cy.get('input[name="adresa"]').type("Beograd, Srbija");
    cy.get('input[name="lozinka"]').type("Test1234!");
    cy.get('input[name="potvrda"]').type("Test1234!");
    cy.get('input[name="telefon"]').type("0641234567");
    cy.get('input[name="datum"]').type("15.05.1990");
    cy.get('input[name="email"]').type("marko@primer.rs");
    cy.get('input[name="pozicija"]').type("Analitičar");
    cy.get('button[type="submit"]').click();
    cy.get(".success-msg").should("contain", "uspešno kreiran");
  });
});
