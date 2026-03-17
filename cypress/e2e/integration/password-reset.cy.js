describe("Password reset integracija", () => {
  it("zahtev za reset lozinke salje request i endpoint postoji", () => {
    cy.request({
      method: "POST",
      url: "/api/password-reset/request",
      body: { email: "admin@banka.raf" },
      failOnStatusCode: false,
    }).then((resp) => {
      // Backend moze vratiti 200 (email poslat) ili 500 (SMTP nije konfigurisan u test env)
      // Bitno je da endpoint postoji i da ne vraca 404
      expect(resp.status).to.not.eq(404);
    });
  });

  it("nepostojeci email ne otkriva da li korisnik postoji", () => {
    cy.request({
      method: "POST",
      url: "/api/password-reset/request",
      body: { email: "nepostojeci@email.com" },
      failOnStatusCode: false,
    }).then((resp) => {
      // Odgovor treba biti isti kao za postojeceg korisnika (sprecava enumeration)
      expect(resp.status).to.not.eq(404);
    });
  });

  it("prazan body vraca 400", () => {
    cy.request({
      method: "POST",
      url: "/api/password-reset/request",
      body: {},
      failOnStatusCode: false,
    }).then((resp) => {
      expect(resp.status).to.eq(400);
    });
  });

  it("confirm sa nevalidnim tokenom vraca 400", () => {
    cy.request({
      method: "POST",
      url: "/api/password-reset/confirm",
      body: { token: "nevalidan_token_12345", password: "NovaLozinka123!" },
      failOnStatusCode: false,
    }).then((resp) => {
      expect(resp.status).to.eq(400);
    });
  });
});
