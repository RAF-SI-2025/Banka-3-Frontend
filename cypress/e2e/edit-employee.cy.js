describe("Izmena zaposlenog", () => {
  beforeEach(() => {
    cy.loginBypass();
    cy.visit("/employees/edit/1");
  });

  it("forma je popunjena postojecim podacima", () => {
    cy.get('input[name="prezime"]').should("have.value", "Petrović");
    cy.get('input[name="pozicija"]').should("have.value", "Menadžer");
  });

  it("korisnik moze izmeniti podatke", () => {
    cy.get('input[name="prezime"]').clear().type("Novi Prezime");
    cy.get('button[type="submit"]').click();
    cy.get(".success-msg").should("contain", "uspešno izmenjen");
  });

  it("validacija pri praznim poljima", () => {
    cy.get('input[name="prezime"]').clear();
    cy.get('button[type="submit"]').click();
    cy.get(".error-msg").should("exist");
  });
});
