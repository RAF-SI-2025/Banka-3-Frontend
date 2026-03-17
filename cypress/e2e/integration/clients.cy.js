describe("Client API integracija", () => {
  let accessToken;

  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { email: "admin@banka.raf", password: "Admin123!" },
    }).then((resp) => {
      accessToken = resp.body.access_token;
    });
  });

  describe("Create Client (POST /api/clients)", () => {
    it("uspesno kreiranje klijenta vraca 201", () => {
      const uniqueEmail = `client-${Date.now()}@primer.rs`;
      cy.request({
        method: "POST",
        url: "/api/clients",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Novi",
          last_name: "Klijent",
          date_of_birth: 631152000,
          gender: "M",
          email: uniqueEmail,
          phone_number: "0641234567",
          address: "Beograd",
          username: "klijent" + Date.now(),
          password: "Test1234!",
        },
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([200, 201]);
        expect(resp.body).to.have.property("valid", true);
      });
    });

    it("gender koji nije M/F vraca 400", () => {
      cy.request({
        method: "POST",
        url: "/api/clients",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Test",
          last_name: "Klijent",
          date_of_birth: 631152000,
          gender: "X",
          email: `client-bad-gender-${Date.now()}@primer.rs`,
          phone_number: "0641234567",
          address: "Beograd",
          username: "clientbadgender" + Date.now(),
          password: "Test1234!",
        },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(400);
      });
    });

    it("nedostaje obavezno polje vraca 400", () => {
      cy.request({
        method: "POST",
        url: "/api/clients",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Test",
          last_name: "Klijent",
          date_of_birth: 631152000,
          gender: "M",
          email: "",
          phone_number: "0641234567",
          address: "Beograd",
          username: "clientmissing" + Date.now(),
          password: "Test1234!",
        },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(400);
      });
    });

    it("duplikat emaila vraca 409", () => {
      const duplicateEmail = `client-dup-${Date.now()}@primer.rs`;
      cy.request({
        method: "POST",
        url: "/api/clients",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          first_name: "Dup",
          last_name: "Klijent",
          date_of_birth: 631152000,
          gender: "M",
          email: duplicateEmail,
          phone_number: "0641234567",
          address: "Beograd",
          username: "clientdup1" + Date.now(),
          password: "Test1234!",
        },
      }).then(() => {
        cy.request({
          method: "POST",
          url: "/api/clients",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            first_name: "Dup",
            last_name: "Klijent2",
            date_of_birth: 631152000,
            gender: "F",
            email: duplicateEmail,
            phone_number: "0649876543",
            address: "Novi Sad",
            username: "clientdup2" + Date.now(),
            password: "Test1234!",
          },
          failOnStatusCode: false,
        }).then((resp) => {
          expect(resp.status).to.eq(409);
        });
      });
    });

    it("prazan body vraca 400", () => {
      cy.request({
        method: "POST",
        url: "/api/clients",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {},
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(400);
      });
    });
  });
});
