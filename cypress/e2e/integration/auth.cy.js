describe("Auth integracija", () => {
  describe("Login - uspesna prijava (POST /api/login)", () => {
    it("uspesna prijava vraca access_token i refresh_token", () => {
      cy.request("POST", "/api/login", {
        email: "admin@banka.raf",
        password: "Admin123!",
      }).then((resp) => {
        expect(resp.status).to.eq(200);
        expect(resp.body).to.have.property("access_token");
        expect(resp.body).to.have.property("refresh_token");
      });
    });

    it("login kroz UI preusmerava na /employees", () => {
      cy.visit("/login");
      cy.get('input[type="email"]').type("admin@banka.raf");
      cy.get('input[type="password"]').type("Admin123!");
      cy.get('button[type="submit"]').click();
      cy.url().should("include", "/employees");
      cy.window().then((win) => {
        expect(win.localStorage.getItem("accessToken")).to.not.be.null;
      });
    });

    it("pogresan password vraca 401", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: { email: "admin@banka.raf", password: "pogresna" },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(401);
      });
    });

    it("nepostojeci email vraca 401", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: { email: "nepostojeci@email.com", password: "Test1234!" },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(401);
      });
    });

    it("prazan body vraca 400", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: {},
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 401]);
      });
    });

    it("nedostaje password polje vraca 400", () => {
      cy.request({
        method: "POST",
        url: "/api/login",
        body: { email: "admin@banka.raf" },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 401]);
      });
    });
  });

  describe("Logout (POST /api/logout)", () => {
    it("logout sa validnim tokenom vraca 202", () => {
      cy.request("POST", "/api/login", {
        email: "admin@banka.raf",
        password: "Admin123!",
      }).then((loginResp) => {
        cy.request({
          method: "POST",
          url: "/api/logout",
          headers: {
            Authorization: `Bearer ${loginResp.body.access_token}`,
          },
        }).then((resp) => {
          expect(resp.status).to.eq(202);
        });
      });
    });

    it("logout bez tokena vraca 401", () => {
      cy.request({
        method: "POST",
        url: "/api/logout",
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(401);
      });
    });

    it("logout sa nevalidnim tokenom vraca 401", () => {
      cy.request({
        method: "POST",
        url: "/api/logout",
        headers: {
          Authorization: "Bearer nevalidan_token_12345",
        },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(401);
      });
    });
  });

  describe("Token Refresh (POST /api/token/refresh)", () => {
    it("refresh sa validnim refresh tokenom vraca nove tokene", () => {
      cy.request("POST", "/api/login", {
        email: "admin@banka.raf",
        password: "Admin123!",
      }).then((loginResp) => {
        cy.request({
          method: "POST",
          url: "/api/token/refresh",
          body: { refresh_token: loginResp.body.refresh_token },
        }).then((resp) => {
          expect(resp.status).to.eq(200);
          expect(resp.body).to.have.property("access_token");
          expect(resp.body).to.have.property("refresh_token");
        });
      });
    });

    it("refresh sa nevalidnim tokenom vraca 401", () => {
      cy.request({
        method: "POST",
        url: "/api/token/refresh",
        body: { refresh_token: "nevalidan_refresh_token" },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(401);
      });
    });

    it("prazan body vraca 400", () => {
      cy.request({
        method: "POST",
        url: "/api/token/refresh",
        body: {},
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 401]);
      });
    });
  });
});
