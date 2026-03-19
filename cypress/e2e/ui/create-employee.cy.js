describe("Kreiranje zaposlenog", () => {
  beforeEach(() => {
    cy.loginBypass();
    cy.visit("/employees/create");
  });

  it("stranica se ucitava sa formom", () => {
    cy.contains("h1", "Napravi novog korisnika");
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
    cy.intercept("POST", "**/api/employees", {
      statusCode: 201,
      body: { valid: true },
    }).as("createEmployee");

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

  it("prikazuje sekciju sa permisijama", () => {
    cy.get(".permissions-section").should("exist");
    cy.get(".permissions-label").should("contain", "PERMISIJE");
    cy.get(".permission-checkbox").should("have.length", 5);
  });

  it("permisije sadrze sve ocekivane opcije", () => {
    cy.get(".permission-text").then(($labels) => {
      const texts = [...$labels].map((el) => el.textContent);
      expect(texts).to.include("Admin");
      expect(texts).to.include("Trgovanje akcijama");
      expect(texts).to.include("Pregled akcija");
      expect(texts).to.include("Upravljanje ugovorima");
      expect(texts).to.include("Upravljanje osiguranjima");
    });
  });

  it("toggle permisije checkbox", () => {
    cy.get(".permission-checkbox").first().click();
    cy.get(".permission-checkbox").first().find('input[type="checkbox"]').should("be.checked");
    cy.get(".permission-checkbox").first().click();
    cy.get(".permission-checkbox").first().find('input[type="checkbox"]').should("not.be.checked");
  });

  it("uspesno kreiranje sa permisijama salje update poziv", () => {
    cy.intercept("POST", "**/api/employees", {
      statusCode: 201,
      body: { valid: true },
    }).as("createEmployee");

    cy.intercept("GET", "**/api/employees?email=marko@primer.rs", {
      statusCode: 200,
      body: [{ id: 99, email: "marko@primer.rs" }],
    }).as("findEmployee");

    cy.intercept("PUT", "**/api/employees/99", {
      statusCode: 200,
      body: { id: 99 },
    }).as("updatePermissions");

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

    cy.get(".permission-checkbox").eq(0).click();
    cy.get(".permission-checkbox").eq(2).click();

    cy.get('button[type="submit"]').click();

    cy.wait("@createEmployee");
    cy.wait("@findEmployee");
    cy.wait("@updatePermissions").its("request.body").should((body) => {
      expect(body.permissions).to.deep.equal(["admin", "view_stocks"]);
    });
    cy.get(".success-msg").should("contain", "uspešno kreiran");
  });

  it("kreiranje bez permisija ne salje update poziv", () => {
    cy.intercept("POST", "**/api/employees", {
      statusCode: 201,
      body: { id: 100 },
    }).as("createEmployee");

    cy.intercept("PUT", "**/api/employees/**").as("updateEmployee");

    cy.get('input[name="ime"]').type("Ana");
    cy.get('input[name="prezime"]').type("Anić");
    cy.get('input[name="pol"]').type("Ženski");
    cy.get('input[name="username"]').type("anaa");
    cy.get('input[name="adresa"]').type("Novi Sad");
    cy.get('input[name="lozinka"]').type("Test1234!");
    cy.get('input[name="potvrda"]').type("Test1234!");
    cy.get('input[name="telefon"]').type("0649876543");
    cy.get('input[name="datum"]').type("20.03.1995");
    cy.get('input[name="email"]').type("ana@primer.rs");
    cy.get('input[name="pozicija"]').type("Menadžer");

    cy.get('button[type="submit"]').click();
    cy.wait("@createEmployee");
    cy.get(".success-msg").should("contain", "uspešno kreiran");

    cy.get("@updateEmployee.all").should("have.length", 0);
  });

  it("prikazuje upozorenje kad update permisija padne", () => {
    cy.intercept("POST", "**/api/employees", {
      statusCode: 201,
      body: { valid: true },
    }).as("createEmployee");

    cy.intercept("GET", "**/api/employees?email=petar@primer.rs", {
      statusCode: 200,
      body: [{ id: 101, email: "petar@primer.rs" }],
    }).as("findEmployee");

    cy.intercept("PUT", "**/api/employees/101", {
      statusCode: 500,
      body: { error: "Internal Server Error" },
    }).as("updatePermissions");

    cy.get('input[name="ime"]').type("Petar");
    cy.get('input[name="prezime"]').type("Petrović");
    cy.get('input[name="pol"]').type("Muški");
    cy.get('input[name="username"]').type("petarp");
    cy.get('input[name="adresa"]').type("Niš");
    cy.get('input[name="lozinka"]').type("Test1234!");
    cy.get('input[name="potvrda"]').type("Test1234!");
    cy.get('input[name="telefon"]').type("0651234567");
    cy.get('input[name="datum"]').type("10.10.1988");
    cy.get('input[name="email"]').type("petar@primer.rs");
    cy.get('input[name="pozicija"]').type("Programer");

    cy.get(".permission-checkbox").eq(1).click();

    cy.get('button[type="submit"]').click();
    cy.wait("@createEmployee");
    cy.wait("@updatePermissions");
    cy.get(".success-msg").should("contain", "dodela permisija nije uspela");
  });
});
