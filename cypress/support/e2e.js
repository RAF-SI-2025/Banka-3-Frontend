import "./commands";

beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.clear();
  });
});
