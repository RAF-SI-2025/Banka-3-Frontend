describe("Izmena zaposlenog", () => {
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
        gender: "Muški",
        phone_number: "+381601234567",
        address: "Knez Mihailova 1, Beograd",
        department: "Menadžment",
      },
    }).as("getEmployee");
    cy.visit("/employees/edit/1");
    cy.wait("@getEmployee");
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
