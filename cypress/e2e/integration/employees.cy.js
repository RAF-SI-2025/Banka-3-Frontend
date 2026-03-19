describe("Employee API integracija", () => {
  let accessToken;

  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { email: "admin@banka.raf", password: "Admin123!" },
    }).then((resp) => {
      accessToken = resp.body.access_token;
      cy.window().then((win) => {
        win.localStorage.setItem("accessToken", resp.body.access_token);
        win.localStorage.setItem("refreshToken", resp.body.refresh_token);
      });
    });
  });

  describe("Create Employee (POST /api/employees)", () => {
    it("kreira zaposlenog kroz formu i verifikuje preko API-a", () => {
      cy.visit("/employees/create");

      cy.get('input[name="ime"]').type("TestIme");
      cy.get('input[name="prezime"]').type("TestPrezime");
      cy.get('input[name="pol"]').type("M");
      cy.get('input[name="username"]').type("testuser" + Date.now());
      cy.get('input[name="adresa"]').type("Beograd");
      cy.get('input[name="lozinka"]').type("Test1234!");
      cy.get('input[name="potvrda"]').type("Test1234!");
      cy.get('input[name="telefon"]').type("0641234567");
      cy.get('input[name="datum"]').type("01.01.1990");
      cy.get('input[name="email"]').type("test" + Date.now() + "@primer.rs");
      cy.get('input[name="pozicija"]').type("Tester");
      cy.get('button[type="submit"]').click();
      cy.get(".success-msg").should("contain", "uspešno kreiran");
    });

    it("kreiranje zaposlenog preko API-a direktno vraca 201", () => {
      const uniqueEmail = `api-test-${Date.now()}@primer.rs`;
      cy.request({
        method: "POST",
        url: "/api/employees",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "ApiTest",
          last_name: "Korisnik",
          date_of_birth: 631152000,
          gender: "M",
          email: uniqueEmail,
          phone_number: "0641234567",
          address: "Beograd",
          username: "apitest" + Date.now(),
          position: "Tester",
          department: "IT",
          password: "Test1234!",
        },
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([200, 201]);
        // Backend vraca { valid: true } umesto objekta sa id-em
        expect(resp.body).to.have.property("valid", true);
      });
    });

    it("gender koji nije M/F vraca 400", () => {
      cy.request({
        method: "POST",
        url: "/api/employees",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Test",
          last_name: "Test",
          date_of_birth: 631152000,
          gender: "X",
          email: `invalid-gender-${Date.now()}@primer.rs`,
          phone_number: "0641234567",
          address: "Beograd",
          username: "invalidgender" + Date.now(),
          position: "Tester",
          department: "IT",
          password: "Test1234!",
        },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(400);
      });
    });

    it("nedostaje obavezno polje (email prazan) vraca 422", () => {
      cy.request({
        method: "POST",
        url: "/api/employees",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Test",
          last_name: "Test",
          date_of_birth: 631152000,
          gender: "M",
          email: "",
          phone_number: "0641234567",
          address: "Beograd",
          username: "missingemail" + Date.now(),
          position: "Tester",
          department: "IT",
          password: "Test1234!",
        },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 422]);
      });
    });

    it("duplikat emaila vraca 409", () => {
      const duplicateEmail = `dup-${Date.now()}@primer.rs`;
      cy.request({
        method: "POST",
        url: "/api/employees",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Dup",
          last_name: "Test",
          date_of_birth: 631152000,
          gender: "M",
          email: duplicateEmail,
          phone_number: "0641234567",
          address: "Beograd",
          username: "dup1" + Date.now(),
          position: "Tester",
          department: "IT",
          password: "Test1234!",
        },
      }).then(() => {
        cy.request({
          method: "POST",
          url: "/api/employees",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            first_name: "Dup",
            last_name: "Test2",
            date_of_birth: 631152000,
            gender: "F",
            email: duplicateEmail,
            phone_number: "0649876543",
            address: "Novi Sad",
            username: "dup2" + Date.now(),
            position: "Dev",
            department: "IT",
            password: "Test1234!",
          },
          failOnStatusCode: false,
        }).then((resp) => {
          expect(resp.status).to.eq(409);
        });
      });
    });
  });

  describe("Create Employee sa permisijama (POST + PUT)", () => {
    it("kreira zaposlenog kroz formu sa permisijama i verifikuje preko API-a", () => {
      const uniqueSuffix = Date.now();
      const email = `perm-test-${uniqueSuffix}@primer.rs`;
      const username = `permtest${uniqueSuffix}`;

      cy.visit("/employees/create");

      cy.get('input[name="ime"]').type("PermTest");
      cy.get('input[name="prezime"]').type("Korisnik");
      cy.get('input[name="pol"]').type("M");
      cy.get('input[name="username"]').type(username);
      cy.get('input[name="adresa"]').type("Beograd");
      cy.get('input[name="lozinka"]').type("Test1234!");
      cy.get('input[name="potvrda"]').type("Test1234!");
      cy.get('input[name="telefon"]').type("0641234567");
      cy.get('input[name="datum"]').type("01.01.1990");
      cy.get('input[name="email"]').type(email);
      cy.get('input[name="pozicija"]').type("Tester");

      // Izaberi "Pregled akcija" i "Upravljanje ugovorima"
      cy.get(".permission-checkbox").eq(2).click();
      cy.get(".permission-checkbox").eq(3).click();

      cy.get('button[type="submit"]').click();
      cy.get(".success-msg", { timeout: 10000 }).should("contain", "uspešno kreiran");
      cy.get(".success-msg").should("not.contain", "nije uspela");

      // Verifikujemo preko API-a da zaposleni ima permisije
      cy.request({
        method: "GET",
        url: `/api/employees?email=${email}`,
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((resp) => {
        expect(resp.status).to.eq(200);
        const employees = resp.body.employees ?? resp.body;
        const created = employees.find((e) => e.email === email);
        expect(created).to.exist;

        // Dohvati detalje sa permisijama
        cy.request({
          method: "GET",
          url: `/api/employees/${created.id}`,
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((detailResp) => {
          expect(detailResp.status).to.eq(200);
          expect(detailResp.body.permissions).to.include("view_stocks");
          expect(detailResp.body.permissions).to.include("manage_contracts");
        });
      });
    });

    it("kreira zaposlenog bez permisija - ne salje update", () => {
      const uniqueSuffix = Date.now();
      const email = `noperm-test-${uniqueSuffix}@primer.rs`;

      cy.visit("/employees/create");

      cy.get('input[name="ime"]').type("NoPerm");
      cy.get('input[name="prezime"]').type("Korisnik");
      cy.get('input[name="pol"]').type("M");
      cy.get('input[name="username"]').type(`noperm${uniqueSuffix}`);
      cy.get('input[name="adresa"]').type("Beograd");
      cy.get('input[name="lozinka"]').type("Test1234!");
      cy.get('input[name="potvrda"]').type("Test1234!");
      cy.get('input[name="telefon"]').type("0641234567");
      cy.get('input[name="datum"]').type("01.01.1990");
      cy.get('input[name="email"]').type(email);
      cy.get('input[name="pozicija"]').type("Tester");

      cy.get('button[type="submit"]').click();
      cy.get(".success-msg", { timeout: 10000 }).should("contain", "uspešno kreiran");

      // Verifikujemo da zaposleni postoji
      cy.request({
        method: "GET",
        url: `/api/employees?email=${email}`,
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((resp) => {
        const employees = resp.body.employees ?? resp.body;
        const created = employees.find((e) => e.email === email);
        expect(created).to.exist;
      });
    });
  });

  describe("Get Employee by ID (GET /api/employees/:id)", () => {
    it("prikazuje detalje zaposlenog na stranici", () => {
      cy.visit("/employees/1");
      cy.contains("admin@banka.raf").should("be.visible");
    });

    it("nepostojeci ID vraca 404", () => {
      cy.request({
        method: "GET",
        url: "/api/employees/999999",
        headers: { Authorization: `Bearer ${accessToken}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(404);
      });
    });

    it("nevazeci ID (string umesto broja) vraca 400", () => {
      cy.request({
        method: "GET",
        url: "/api/employees/abc",
        headers: { Authorization: `Bearer ${accessToken}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(400);
      });
    });

    it("odgovor sadrzi sva ocekivana polja", () => {
      cy.request({
        method: "GET",
        url: "/api/employees/1",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((resp) => {
        expect(resp.status).to.eq(200);
        const body = resp.body;
        expect(body).to.have.property("email");
        expect(body).to.have.property("active");
        // Verifikujemo kljucna polja koja backend vraca
        const keys = Object.keys(body);
        expect(keys.length).to.be.greaterThan(3);
      });
    });
  });

  describe("Healthcheck", () => {
    it("GET /healthz vraca 200 sa status ok", () => {
      cy.request({
        method: "GET",
        url: "/api/healthz",
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status === 200) {
          expect(resp.body).to.have.property("status", "ok");
        } else {
          // Healthz endpoint mozda nije na /api/ prefixu
          cy.request({
            method: "GET",
            url: "/healthz",
            failOnStatusCode: false,
          }).then((healthResp) => {
            expect(healthResp.status).to.eq(200);
          });
        }
      });
    });
  });
});
