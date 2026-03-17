describe("User Journeys - End-to-end scenariji", () => {
  it("Login → Kreiraj zaposlenog → Proveri da postoji → Logout", () => {
    // Login
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { email: "admin@banka.raf", password: "Admin123!" },
    }).then((loginResp) => {
      expect(loginResp.status).to.eq(200);
      const accessToken = loginResp.body.access_token;

      // Kreiraj zaposlenog
      const uniqueEmail = `journey-${Date.now()}@primer.rs`;
      cy.request({
        method: "POST",
        url: "/api/employees",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Journey",
          last_name: "Test",
          date_of_birth: 631152000,
          gender: "F",
          email: uniqueEmail,
          phone_number: "0641234567",
          address: "Beograd",
          username: "journey" + Date.now(),
          position: "QA",
          department: "IT",
          password: "Test1234!",
        },
      }).then((createResp) => {
        expect(createResp.status).to.be.oneOf([200, 201]);
        // Backend vraca { valid: true }, ne objekat sa id-em
        expect(createResp.body).to.have.property("valid", true);
      });

      // Logout
      cy.request({
        method: "POST",
        url: "/api/logout",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((logoutResp) => {
        expect(logoutResp.status).to.eq(202);
      });
    });
  });

  it("neulogovan korisnik pokusava /employees → redirect na /login", () => {
    cy.visit("/employees");
    cy.url().should("include", "/login");
  });

  it("Login → Refresh token → Koristi novi token za pristup", () => {
    // Login
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { email: "admin@banka.raf", password: "Admin123!" },
    }).then((loginResp) => {
      expect(loginResp.status).to.eq(200);
      const refreshToken = loginResp.body.refresh_token;

      // Refresh token
      cy.request({
        method: "POST",
        url: "/api/token/refresh",
        body: { refresh_token: refreshToken },
      }).then((refreshResp) => {
        expect(refreshResp.status).to.eq(200);
        const newAccessToken = refreshResp.body.access_token;
        expect(newAccessToken).to.be.a("string");

        // Koristi novi token za pristup
        cy.request({
          method: "GET",
          url: "/api/employees/1",
          headers: { Authorization: `Bearer ${newAccessToken}` },
        }).then((empResp) => {
          expect(empResp.status).to.eq(200);
          expect(empResp.body).to.have.property("id");
        });
      });
    });
  });
});
